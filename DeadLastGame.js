var io;
var gameSocket;
var rooms = {}; // object that holds rooms values

/**
 * DeadLastGame.js
 *
 */
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('onCreateNewGame', onCreateNewGame);
	gameSocket.on('onStartGame', onStartGame);

    // Player Events
    gameSocket.on('onJoinGame', onJoinGame);

	// both host and player events
	gameSocket.on('onSubmitVote', onSubmitVote);
}

// Host has clicked the 'CREATE GAME' button with valid username
function onCreateNewGame(data) {
    // create game session ID
    var roomCode = ( Math.random() * 100000 ) | 0;

    // Return the roomCode and the socket ID to the browser client
    this.emit('createLobby', {roomCode: roomCode, socketId: this.id});

    // Join the Room and wait for the players
    this.join(roomCode.toString());

	// create room's player list
	rooms[roomCode.toString()] = {};
	rooms[roomCode.toString()]["playerList"] = [];
	rooms[roomCode.toString()]["playerList"].push(data.username);
}

// Host has clicked start game
// data = {roomCode:}
function onStartGame(data) {
	console.log('Starting Game');
	rooms[data.roomCode]["totalVotes"] = 0; // reset the total votes for new game
	// reset the players alive
	rooms[data.roomCode]["playersAlive"] = rooms[data.roomCode]["playerList"];
	// reset all votes to zero
	rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	// reset gold to zero
	rooms[data.roomCode]["goldTokens"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	rooms[data.roomCode]["goldValue"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	// Emit an event having all players in lobby begin game
    io.sockets.in(data.roomCode).emit('initGame');
}

// JOIN GAME has been pressed with roomCode and a valid username
// data = {roomCode: , username: }
function onJoinGame(data) {
    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.roomCode];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        mySocketId = this.id;

        // Join the room
        this.join(data.roomCode);
		
		// add player to player list of room
		rooms[data.roomCode]["playerList"].push(data.username);

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.roomCode).emit('playerJoinedRoom', {socketId: mySocketId, playerList: rooms[data.roomCode]["playerList"], roomCode: data.roomCode});

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

// Submit Vote has been pressed
// data = {roomCode: , vote: , username: }
function onSubmitVote(data) {
	console.log('Player: '+data.username+' voted for player: '+data.vote);
	// count the vote
	rooms[data.roomCode]["playerVoteCnts"][rooms[data.roomCode]["playersAlive"].indexOf(data.vote)]++;
	rooms[data.roomCode]["totalVotes"]++;
	// record who player voted for
	rooms[data.roomCode]["playerVotes"][rooms[data.roomCode]["playersAlive"].indexOf(data.username)] = data.vote;
	if(rooms[data.roomCode]["totalVotes"]>=rooms[data.roomCode]["playerList"].length){
		// if everyone has voted calculate the voting results and end the round
		var maxIndices = getMaxIndices(rooms[data.roomCode]["playerVoteCnts"]);
		var eliminatedPlayers = [];
		for (var i = 0; i < maxIndices.length; i++){
			eliminatedPlayers.push(rooms[data.roomCode]["playersAlive"][maxIndices[i]]);
			rooms[data.roomCode]["playersAlive"].splice(maxIndices[i],1);
		}
		// send round results to clients in this room
		io.sockets.in(data.roomCode).emit('votingDone', {voteCnts: rooms[data.roomCode]["playerVoteCnts"],
			playerVotes: rooms[data.roomCode]["playerVotes"], playersElimed: eliminatedPlayers, playersAlive: rooms[data.roomCode]["playersAlive"]});
		
		//reset number of votes
		rooms[data.roomCode]["totalVotes"]
		// reset all votes to zero
		rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	}
	else{
		// Emit an event notifying the clients that a player has voted
		io.sockets.in(data.roomCode).emit('playerVoted', {playerDone: data.username});
	}
}

function getMaxIndices(arr) {
    var max = arr[0];
    var maxIndex = [];
	maxIndex.push(0);

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
			maxIndex = [];
            maxIndex.push(i);
            max = arr[i];
        }
		else if(arr[i] == max){
			maxIndex.push(i);
		}
    }

    return maxIndex;
}

