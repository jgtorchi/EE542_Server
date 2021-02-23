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
	gameSocket.on('onSubmitAmbush', onSubmitAmbush);
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
	// add host to player list
	rooms[roomCode.toString()]["playerList"].push(data.username);
}

// Host has clicked start game
// data = {roomCode:}
function onStartGame(data) {
	console.log('Starting Game');
	rooms[data.roomCode]["totalVotes"] = 0; // reset the total votes for new game
	// reset the players alive
	rooms[data.roomCode]["playersAlive"] = rooms[data.roomCode]["playerList"].slice();
	// reset all votes to zero
	rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playerList"].length).fill(0);
	rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playerList"].length).fill(0);
	// reset gold to zero
	rooms[data.roomCode]["goldPieces"] = new Array(rooms[data.roomCode]["playerList"].length).fill(0);
	rooms[data.roomCode]["goldValue"] = new Array(rooms[data.roomCode]["playerList"].length).fill(0);
	// reset players succesfully ambushing
	rooms[data.roomCode]["ambushingPlayers"] = [];
	rooms[data.roomCode]["ambushSummary"] = [];
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
	if(data.vote !== 'Ambush'){
		//console.log('Player: '+data.username+' did not ambush');
		// count the vote, if player did not select ambush
		rooms[data.roomCode]["playerVoteCnts"][rooms[data.roomCode]["playersAlive"].indexOf(data.vote)]++;
	}
	rooms[data.roomCode]["totalVotes"]++;
	// record who player voted for
	rooms[data.roomCode]["playerVotes"][rooms[data.roomCode]["playersAlive"].indexOf(data.username)] = data.vote;
	console.log('Player: '+data.username+' voted for player: '+data.vote);
	console.log('Round votes: ' +rooms[data.roomCode]["playerVotes"]);
	console.log('Round vote count: ' +rooms[data.roomCode]["playerVoteCnts"]);
	if(rooms[data.roomCode]["totalVotes"]>=rooms[data.roomCode]["playersAlive"].length){
		// if everyone has voted calculate the voting results and end the round
		console.log('round is now over, determining players eliminated');
		var [maxVote, maxIndices] = getMaxIndices(rooms[data.roomCode]["playerVoteCnts"]);
		var eliminatedPlayers = [];
		// eliminate players who were majority vote and did not ambush
		for (var i = 0; i < maxIndices.length; i++){
			console.log('Getting Elimed Players');
			console.log('Player: '+rooms[data.roomCode]["playersAlive"][maxIndices[i]]+' was majority vote');
			console.log('They chose '+rooms[data.roomCode]["playerVotes"][maxIndices[i]]);
			if(rooms[data.roomCode]["playerVotes"][maxIndices[i]]!=='Ambush'){
				console.log('Player: '+rooms[data.roomCode]["playersAlive"][maxIndices[i]]+' did not ambush');
				// eliminate majority vote players if they did not select ambush
				eliminatedPlayers.push(rooms[data.roomCode]["playersAlive"][maxIndices[i]]);
			}
			else{
				// store succesful ambushing plauers in the ambushingPlayers list
				rooms[data.roomCode]["ambushingPlayers"].push(rooms[data.roomCode]["playersAlive"][maxIndices[i]]);
			}
		}

		// eliminate players who did not vote with majority, and were not the majority vote itself
		for (var i = 0; i < rooms[data.roomCode]["playersAlive"].length; i++){
			// get index of the player's vote
			var voteIdx = rooms[data.roomCode]["playersAlive"].indexOf(rooms[data.roomCode]["playerVotes"][i]);
			if((!maxIndices.includes(i)) && (!maxIndices.includes(voteIdx)) ){
				// if player is not the majority vote and player did not make a majority vote
				// then they are eliminated
				eliminatedPlayers.push(rooms[data.roomCode]["playersAlive"][i]);
			}
		}

		// remove all eliminated players from the players alive list
		for (var i = 0; i < eliminatedPlayers.length; i++){
			var plrIdx = rooms[data.roomCode]["playersAlive"].indexOf(eliminatedPlayers[i]);
			rooms[data.roomCode]["playersAlive"].splice(plrIdx,1);
		}

		if((rooms[data.roomCode]["playersAlive"].length<=2)&&(rooms[data.roomCode]["ambushingPlayers"].length==0)){
			// if round is over (two or less players left and there are no succesfully ambushing players)	
			// reward the remaining survivors	
			rewardSurvivors(data);
			if(!checkGameOver(data)){
				// if game is not over, send the round's results to the clients in this room
				io.sockets.in(data.roomCode).emit('votingDone', {maxVote: maxVote, majorityVoteIdxs: maxIndices,ambushingPlayers: rooms[data.roomCode]["ambushingPlayers"],
					playerVotes: rooms[data.roomCode]["playerVotes"], playersElimed: eliminatedPlayers, playersAlive: rooms[data.roomCode]["playersAlive"],
					goldPieces: rooms[data.roomCode]["goldPieces"]});
			}
			
			// reset players alive
			rooms[data.roomCode]["playersAlive"] = rooms[data.roomCode]["playerList"].slice();
		}
		else{	
			// otherwise, send voting results to clients in this room
			io.sockets.in(data.roomCode).emit('votingDone', {maxVote: maxVote, majorityVoteIdxs: maxIndices, ambushingPlayers: rooms[data.roomCode]["ambushingPlayers"],
				playerVotes: rooms[data.roomCode]["playerVotes"], playersElimed: eliminatedPlayers, playersAlive: rooms[data.roomCode]["playersAlive"],
				goldPieces: rooms[data.roomCode]["goldPieces"]});
		}
		
		//reset number of votes
		rooms[data.roomCode]["totalVotes"] = 0;
		// reset all votes to zero
		rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	}
	else{
		// Emit an event notifying the clients that a player has voted
		io.sockets.in(data.roomCode).emit('playerVoted', {playerDone: data.username});
	}
}

// Submit Ambush has been pressed
// data = {roomCode: , vote: , username: }
function onSubmitAmbush(data) {
	// first remove the player from the playersAlive list
	console.log(data.username+' is ambushing '+data.vote);
	if(rooms[data.roomCode]["playersAlive"].includes(data.vote)){
		// only remove if player exists in playersAlive list
		var plrIdx = rooms[data.roomCode]["playersAlive"].indexOf(data.vote);
		rooms[data.roomCode]["playersAlive"].splice(plrIdx,1);
	}
	var idx = rooms[data.roomCode]["ambushingPlayers"].indexOf(data.username);
	var summary = {ambusher: data.username, target: data.vote}; 
	rooms[data.roomCode]["ambushSummary"].push(summary);
	rooms[data.roomCode]["ambushingPlayers"].splice(idx,1);
	console.log('Updated Ambush List: '+rooms[data.roomCode]["ambushingPlayers"]);
	if((rooms[data.roomCode]["ambushingPlayers"].length==0)){
		// if there are no more ambushers
		console.log('No more ambushers');
		if(rooms[data.roomCode]["playersAlive"].length<=2){
			// if there are only 2 survivors the round is over
			// reward the remaining survivors	
			rewardSurvivors(data);
		}
		if(!checkGameOver(data)){
			console.log('Sending Ambush summary to clients');
			// if game is not over send the ambush summary to the clients
			io.sockets.in(data.roomCode).emit('ambushOver', {ambushSummary: rooms[data.roomCode]["ambushSummary"],
				playersAlive: rooms[data.roomCode]["playersAlive"], goldPieces: rooms[data.roomCode]["goldPieces"]});
			// update length of voting arrays
			rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
			rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		}
		// clear the ambush summary
		rooms[data.roomCode]["ambushSummary"] = [];
	}
	else{
		// Emit an event notifying the clients that a player has ambushed, give them new ambush list
		io.sockets.in(data.roomCode).emit('playerAmbushed', {ambushingPlayers: rooms[data.roomCode]["ambushingPlayers"]});
	}
}

// rewards remaining survivors with 4 gold pieces split between them
function rewardSurvivors(data) {
	if(rooms[data.roomCode]["playersAlive"].length > 0) {
		// if there are living players give them gold
		if(rooms[data.roomCode]["playersAlive"].length == 1) {
			// if only one player left give them 4 gold pieces
			console.log(rooms[data.roomCode]["playerList"][0]+' is being given gold');
			rooms[data.roomCode]["goldPieces"][0] = rooms[data.roomCode]["goldPieces"][0] + 4;
			rooms[data.roomCode]["goldValue"][0] = rooms[data.roomCode]["goldValue"][0]+between(3, 5)+between(3, 5)+between(3, 5)+between(3, 5);
		}
		else{
			// give remaining players two gold pieces each
			for (var i = 0; i < rooms[data.roomCode]["playersAlive"].length; i++) {
				var plrIdx = rooms[data.roomCode]["playerList"].indexOf(rooms[data.roomCode]["playersAlive"][i]);
				console.log(rooms[data.roomCode]["playerList"][plrIdx]+' is being given gold');
				rooms[data.roomCode]["goldPieces"][plrIdx] = rooms[data.roomCode]["goldPieces"][plrIdx] + 2;
				rooms[data.roomCode]["goldValue"][plrIdx] = rooms[data.roomCode]["goldValue"][plrIdx]+between(3, 5)+between(3, 5);
			}
		}
	}
}

function checkGameOver(data) {
	// find the max gold value among players
	var [maxGold, winnerIdxs] = getMaxIndices(rooms[data.roomCode]["goldValue"]);
	if(maxGold>30){
		// if a player has over 30 gold they have won and the game is over
		// first get the winner's names
		console.log('Game Over')
		var winners = [];
		for (var i = 0; i < winnerIdxs.length; i++) {
			winners.push(rooms[data.roomCode]["playerList"][winnerIdxs[i]]);
		}
		// send the game winning results to clients in this room
		io.sockets.in(data.roomCode).emit('gameOver', {winners: winners,goldValue: rooms[data.roomCode]["goldValue"]});
		return true;
	}
	else{
		return false;
	}
}

// General Utility helper functions

// get indice(s) of max value(s) in an array
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

    return [max, maxIndex];
}

// generate random value between min and max
function between(min, max) {  
  return Math.floor(
    Math.random() * (max - min + 1) + min
  )
}