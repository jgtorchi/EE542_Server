var io;
var gameSocket;
var rooms = [];
var playerLists = [];

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('onCreateNewGame', onCreateNewGame);

    // Player Events
    gameSocket.on('onJoinGame', onJoinGame);
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
	rooms.push(roomCode.toString());
	var tempList = [];
	tempList.push(data.username);
	playerLists.push(tempList);
};

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
		var idx = rooms.indexOf(data.roomCode);
		playerLists[idx].push(data.username);
		var playerList = playerLists[idx];

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.roomCode).emit('playerJoinedRoom', {socketId: mySocketId, playerList: playerList, roomCode: data.roomCode});

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}