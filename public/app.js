jQuery(function($){    
    var IO = {

        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */
        init: function() {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         * While connected, Socket.IO will listen to the following events emitted
         * by the Socket.IO server, then run the appropriate function.
         */
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
			IO.socket.on('createLobby', App.createLobby );
			IO.socket.on('playerJoinedRoom',App.joinedLobby);
			IO.socket.on('error',App.error);
        },

        /**
         * The client is successfully connected!
         */
        onConnected : function() {
            // Cache a copy of the client's socket.IO session ID on the App
            App.userSocketId = IO.socket.socket.sessionid;
        },

    };

    var App = {

        /**
         * This is used to differentiate between 'Host' and 'Player' browsers.
         */
        userRole: '',   // 'Player' or 'Host'

        /**
         * The Socket.IO socket object identifier. This is unique for
         * each player and host. It is generated when the browser initially
         * connects to the server when the page loads for the first time.
         */
        userSocketId: '',

		// the room code of the game. This is specific to each game. (it's the socket room ID)
		roomCode: '',

		// player name
		name : '',

		// player list, built by host and sent out to all players
		players : [],

        /* *************************************
         *                Setup                *
         * *********************************** */

        // This runs when the page initially loads.
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();
        },

        /**
         * Create references to on-screen elements used throughout the game.
         */
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
			App.$templateHostGame = $('#host-game-template').html();
			App.$templateJoinGame = $('#join-game-template').html();
			App.$templateHowToPlay = $('#how-to-play-template').html();
			App.$templateHostGameLobby = $('#host-game-lobby-template').html();
			App.$templatePlayerGameLobby = $('#player-game-lobby-template').html();

        },

        /**
         * Create some click handlers for the various buttons that appear on-screen.
         */
        bindEvents: function () {
			//Neutral
			App.$doc.on('click', '#btnHowToPlay', App.showHowTo);
			App.$doc.on('click', '#btnHostGame', App.showHost);
			App.$doc.on('click', '#btnPreJoinGame', App.showJoin);
			App.$doc.on('click', '#btnReturnHome', App.showInitScreen);

            // Host
			App.$doc.on('click', '#btnCreateGame', App.createGame);

            // Player
			App.$doc.on('click', '#btnJoinGame', App.joinGame);
            
        },

        // responses to button clicks

        // Show the initial Title Screen
        showInitScreen: function() {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit('.title');
        },

		// show host game screen
		showHost: function() {
            App.$gameArea.html(App.$templateHostGame);
        },

		// show join game screen
		showJoin: function() {
            App.$gameArea.html(App.$templateJoinGame);
        },

		// show how to screen
		showHowTo: function() {
            App.$gameArea.html(App.$templateHowToPlay);
            App.doTextFit('.title');
        },

		createGame: function () {
			var hostName = $('#inputHostName').val();
			if(hostName.length == 0){
				alert("A username must be entered");
			}
			else{
				// add host name to player list
				App.players.push(hostName);
				App.name = hostName;
		        IO.socket.emit('onCreateNewGame',{username: hostName});
			}
        },

		joinGame: function () {
			var playerName = $('#inputPlayerName').val();
			var inputRoomCode = $('#inputRoomCode').val();
			if(playerName.length == 0){
				alert("A username must be entered");
			}
			else if (inputRoomCode.length == 0){
				alert("A room code must be entered");
			}
			else{
				App.name = playerName;
				IO.socket.emit('onJoinGame',{roomCode: inputRoomCode, username: playerName} );
			}
        },

		// show lobby screen after response from server and store game data
		createLobby: function(data) {
            App.userSocketId = data.socketId;
			App.roomCode = data.roomCode;
            App.userRole = 'Host';
			//display the newly created game's lobby
            App.$gameArea.html(App.$templateHostGameLobby);
			// update the player list
			App.updatePlayerList();
			$('#hostRoomCode').text('Room Code: ');
			$('#hostRoomCode').append(App.roomCode);
            App.doTextFit('.title');
        },

		// in response to plyaer joining room on server side
		// show lobby to new players 
		// update player list
		joinedLobby: function(data) {
			App.players = data.playerList;
			if(App.userRole !== 'Host'){
				App.userSocketId = data.socketId;
				App.roomCode = data.roomCode;
		        App.userRole = 'Player';
				//display the game's lobby
            	App.$gameArea.html(App.$templatePlayerGameLobby);
				$('#playerRoomCode').text('Room Code: ');
				$('#playerRoomCode').append(App.roomCode);
				App.doTextFit('.title');
			}
			App.updatePlayerList();
		},

		updatePlayerList: function (){
			if(App.userRole == 'Host'){
				$('#hostPlayerList').text('Player List:');
				var i;
				for (i = 0; i < App.players.length; i++) {
					$('#hostPlayerList').append('<br/>');
					$('#hostPlayerList').append(App.players[i]);
				}
			}
			else{
				$('#playerList').text('Player List:');
				var i;
				for (i = 0; i < App.players.length; i++) {
					$('#playerList').append('<br/>');
					$('#playerList').append(App.players[i]);
				}
			}
			//console.log('Updated Player List');
        },
		
		error: function (data){
			alert(data.message);
		},


        /**
         * Make the text inside the given element as big as possible
         * See: https://github.com/STRML/textFit
         *
         * @param el The parent element of some text
         */
        doTextFit : function(el) {
            textFit(
                $(el)[0],
                {
                    alignHoriz:true,
                    alignVert:false,
                    widthOnly:true,
                    reProcess:true,
                    maxFontSize:300
                }
            );
        }

    };

    IO.init();
    App.init();

}($));
