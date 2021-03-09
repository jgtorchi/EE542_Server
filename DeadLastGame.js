// Title: DeadLastGame.js
// Author: Jacob Torchia
// Descrition: Server side code for DeadLast game
// manages all the lobbies and synchronises players in a lobby
// Code based off of github guide and repo at the below address: 
// https://github.com/FrontenderMagazine/building-multiplayer-games-with-node-js-and-socket-io/blob/master/eng.md

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
	gameSocket.on('onSubmitShowdown', onSubmitShowdown);
}

// Host has clicked the 'CREATE GAME' button with valid username
// data = {username:}
function onCreateNewGame(data) {
	if(data.username == 'Ambush'){
		// tell player their name cannot be Ambush
        this.emit('error',{message: "Username cannot be Ambush"} );
	}
	else if(data.username.length <= 0){
		// tell player their name is too short
        this.emit('error',{message: "Username is too short"} );
	}
	else if(data.username.length >= 13){
		// tell player their name is too long
        this.emit('error',{message: "Username is too long"} );
	}
	else{
		var roomExists = true;
		while (roomExists){
			// create room code
			var roomCode = ( Math.random() * 100000 ) | 0;
			
			var room = gameSocket.manager.rooms["/" + data.roomCode];

			// check if the room already exists
			roomExists = (room != undefined);
			// if room  already exists generate a new room code and check again
		}
		
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
	// reset showdown summary
	rooms[data.roomCode]["showdownSummary"] = [];
	// Emit an event having all players in lobby begin game
    io.sockets.in(data.roomCode).emit('initGame');
}

// JOIN GAME has been pressed with roomCode and a valid username
// data = {roomCode: , username: }
function onJoinGame(data) {
	if(data.username == 'Ambush'){
		// tell player their name cannot be Ambush
        this.emit('error',{message: "Username cannot be Ambush"} );
	}
	else if(data.username.length <= 0){
		// tell player their name is too short
        this.emit('error',{message: "Username is too short"} );
	}
	else if(data.username.length >= 13){
		// tell player their name is too long
        this.emit('error',{message: "Username is too long"} );
	}
	else{
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
		if(maxVote==0){
			// if no one was voted for (everyone ambushed)
			// everyone is eilminated
			eliminatedPlayers = rooms[data.roomCode]["playersAlive"].slice();
			// no one is left alive
			rooms[data.roomCode]["playersAlive"] = [];
		}
		else{
			// otherwise go throuh normal elimination rules
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
					// store succesful ambushing players in the ambushingPlayers list
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
		}
		if((rooms[data.roomCode]["playersAlive"].length<=1)&&(rooms[data.roomCode]["ambushingPlayers"].length==0)){
			// if round is over (one or less players left and there are no succesfully ambushing players)	
			// reward the remaining survivor	
			rewardSurvivor(data);
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
		if(rooms[data.roomCode]["playersAlive"].length<=1){
			// if there is only 1 or less survivors the round is over
			// reward the remaining survivor	
			rewardSurvivor(data);
			if(!checkGameOver(data)){
				console.log('Sending Ambush summary to clients');
				// if game is not over send the ambush summary to the clients
				io.sockets.in(data.roomCode).emit('ambushOver', {ambushSummary: rooms[data.roomCode]["ambushSummary"],
					playersAlive: rooms[data.roomCode]["playersAlive"], goldPieces: rooms[data.roomCode]["goldPieces"]});
				
			}
			// reset players alive
			rooms[data.roomCode]["playersAlive"] = rooms[data.roomCode]["playerList"].slice();
		}
		else{
			//send the ambush summary to the clients
			io.sockets.in(data.roomCode).emit('ambushOver', {ambushSummary: rooms[data.roomCode]["ambushSummary"],
				playersAlive: rooms[data.roomCode]["playersAlive"], goldPieces: rooms[data.roomCode]["goldPieces"]});
		}

		// update length of voting arrays
		rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		
		// clear the ambush summary
		rooms[data.roomCode]["ambushSummary"] = [];
	}
	else{
		// Emit an event notifying the clients that a player has ambushed, give them new ambush list
		io.sockets.in(data.roomCode).emit('playerAmbushed', {ambushingPlayers: rooms[data.roomCode]["ambushingPlayers"]});
	}
}

// Submit Ambush has been pressed
// data = {roomCode: , action: , username: }
function onSubmitShowdown(data) {
	var summary = {player: data.username, action: data.action, goldGiven: 0}; 
	rooms[data.roomCode]["showdownSummary"].push(summary);
	if(rooms[data.roomCode]["showdownSummary"].length>=2){
		// if all alive players have taken a showdown action (there should only be 2 players alive)
		// determine the results of the showdown
		if((rooms[data.roomCode]["showdownSummary"][0].action=='steal')&&(rooms[data.roomCode]["showdownSummary"][1].action=='steal')){
			// if both players selet steal, then give everyone else in the lobby 1 gold piece
			for (var i = 0; i < rooms[data.roomCode]["playerList"].length; i++) {
				if((rooms[data.roomCode]["playerList"][i]!==rooms[data.roomCode]["showdownSummary"][0].player)&&
				(rooms[data.roomCode]["playerList"][i]!==rooms[data.roomCode]["showdownSummary"][1].player)){
					// if player is not one of the showdown contestants, give them a gold piece
					rooms[data.roomCode]["goldPieces"][i] = rooms[data.roomCode]["goldPieces"][i] + 1;
					rooms[data.roomCode]["goldValue"][i] = rooms[data.roomCode]["goldValue"][i]+getGold();
				}
			}
		}
		else{
			if(rooms[data.roomCode]["showdownSummary"][1].action == 'grab'){
				// player 1 selected grab, they are guarenteed 1 gold
				rooms[data.roomCode]["showdownSummary"][1].goldGiven = 1;
			}
			if(rooms[data.roomCode]["showdownSummary"][0].action == 'grab'){
				// player 0 selected grab, they are guarenteed 1 gold
				rooms[data.roomCode]["showdownSummary"][0].goldGiven = 1;
				if(rooms[data.roomCode]["showdownSummary"][1].action !== 'grab'){
					// player 1 didn't select grab and go, they get 3 gold
					rooms[data.roomCode]["showdownSummary"][1].goldGiven = 3;
				}
			}
			else if(rooms[data.roomCode]["showdownSummary"][0].action == 'share'){
				// player 0 selected share
				if(rooms[data.roomCode]["showdownSummary"][1].action == 'share'){
					// player 1 selected share as well, split the pot (2 each)
					rooms[data.roomCode]["showdownSummary"][0].goldGiven = 2;
					rooms[data.roomCode]["showdownSummary"][1].goldGiven = 2;
				}
				else if(rooms[data.roomCode]["showdownSummary"][1].action == 'steal'){
					// player 1 selected steal, they get all the gold
					rooms[data.roomCode]["showdownSummary"][1].goldGiven = 4;
				}
			}
			else{
				// player 0 selected steal
				if(rooms[data.roomCode]["showdownSummary"][1].action == 'share'){
					// player 1 selected share, but player 0 selected steal (player 0 gets 4 gold pieces)
					rooms[data.roomCode]["showdownSummary"][0].goldGiven = 4;
				}
				else if(rooms[data.roomCode]["showdownSummary"][1].action == 'grab'){
					// player 1 selected grab, player 0 steals the remaining 3
					rooms[data.roomCode]["showdownSummary"][0].goldGiven = 3;
				}
			}
			
			// award gold to players according to the goldGiven field of the "showdownSummary"
			for (var i = 0; i < rooms[data.roomCode]["showdownSummary"].length; i++) {
				var plrIdx = rooms[data.roomCode]["playerList"].indexOf(rooms[data.roomCode]["showdownSummary"][i].player);
				rooms[data.roomCode]["goldPieces"][plrIdx] = rooms[data.roomCode]["goldPieces"][plrIdx] + rooms[data.roomCode]["showdownSummary"][i].goldGiven;
				for (var j = 0; j < rooms[data.roomCode]["showdownSummary"][i].goldGiven; j++) {
					rooms[data.roomCode]["goldValue"][plrIdx] = rooms[data.roomCode]["goldValue"][plrIdx]+getGold();
				}
			}
		}
		console.log(rooms[data.roomCode]["showdownSummary"][0].player+' given '+rooms[data.roomCode]["showdownSummary"][0].goldGiven+' gold');
		console.log(rooms[data.roomCode]["showdownSummary"][1].player+' given '+rooms[data.roomCode]["showdownSummary"][1].goldGiven+' gold');
		console.log('Gold Value: '+rooms[data.roomCode]["goldValue"]);
		console.log('Gold Pieces: '+rooms[data.roomCode]["goldPieces"]);
		if(!checkGameOver(data)){
			// if game is not over then end the round
			io.sockets.in(data.roomCode).emit('showdownOver', {showdownSummary: rooms[data.roomCode]["showdownSummary"], 
				goldPieces: rooms[data.roomCode]["goldPieces"]});
			rooms[data.roomCode]["showdownSummary"] = [];
		}
		// reset players alive
		rooms[data.roomCode]["playersAlive"] = rooms[data.roomCode]["playerList"].slice();
		//reset number of votes
		rooms[data.roomCode]["totalVotes"] = 0;
		// reset all votes to zero
		rooms[data.roomCode]["playerVoteCnts"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
		rooms[data.roomCode]["playerVotes"] = new Array(rooms[data.roomCode]["playersAlive"].length).fill(0);
	}
	else{
		// otherwise, update the showdown waiting list
		// Emit an event notifying the clients that a player has taken showdown action, update the showdown waiting list
		io.sockets.in(data.roomCode).emit('playerShowed', {player: data.username});
	}
}


// Helper functions, not caused directly by client

// rewards remaining survivor with 4 gold pieces
function rewardSurvivor(data) {
	if(rooms[data.roomCode]["playersAlive"].length == 1) {
		// if only one player left give them 4 gold pieces
		var plrIdx = rooms[data.roomCode]["playerList"].indexOf(rooms[data.roomCode]["playersAlive"][0]);
		console.log(rooms[data.roomCode]["playerList"][plrIdx]+' is being given gold');
		rooms[data.roomCode]["goldPieces"][plrIdx] = rooms[data.roomCode]["goldPieces"][0] + 4;
		rooms[data.roomCode]["goldValue"][plrIdx] = rooms[data.roomCode]["goldValue"][0]+getGold()+getGold()+getGold()+getGold();
	}
	console.log('Gold pieces for each player: '+rooms[data.roomCode]["goldPieces"]);
	console.log('Gold value for each player: '+rooms[data.roomCode]["goldValue"]);
}

function checkGameOver(data) {
	// find the max gold value among players
	var [maxGold, winnerIdxs] = getMaxIndices(rooms[data.roomCode]["goldValue"]);
	if(maxGold>30){
		// if a player has over 30 gold they have won and the game is over
		// first get the winner's names
		console.log('Game Over')
		console.log('Winner Idxs: '+winnerIdxs)
		var winners = [];
		for (var i = 0; i < winnerIdxs.length; i++) {
			winners.push(rooms[data.roomCode]["playerList"][winnerIdxs[i]]);
		}
		console.log('Winners: '+winners)
		// send the game winning results to clients in this room
		io.sockets.in(data.roomCode).emit('gameOver', {winners: winners,goldValue: rooms[data.roomCode]["goldValue"]});
		return true;
	}
	else{
		return false;
	}
}

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

// generate gold value between min and max
function getGold() {  
	// currently uniform distribution between 3 and 5
	// may change distribution of gold values later
	var min = 3;
	var max = 5;
	return Math.floor(
		Math.random() * (max - min + 1) + min
	)
}