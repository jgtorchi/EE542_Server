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
			IO.socket.on('initGame',App.initGame);
			IO.socket.on('playerVoted',App.playerVoted);
			IO.socket.on('votingDone',App.dispPlayerActions);
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

		// player list, recieved from server
		players : [],

		// alive players
		playersAlive : [],

		// serves as list of players alive at beginning of round
		// previously alive
		prevAlive : [],

		//players who have voted
		playersDone : [],

		//players who got eliminated this round
		playersElimed : [],

		//players who got eliminated this round
		voteCnts : [],

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
			App.$templateVotingScreen = $('#voting-screen-template').html();
			App.$waitingScreen = $('#waiting-screen-template').html();
			App.$playerActionsScreen = $('#display-player-actions-screen-template').html();
			App.$voteTotalsScreen = $('#display-vote-totals-screen-template').html();
			App.$resultsScreen = $('#results-screen-template').html();

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
			App.$doc.on('click', '#btnSubmitVote', App.submitVote);
			App.$doc.on('click', '#btnViewVoteTotals', App.showVoteTotals);
			App.$doc.on('click', '#btnViewResults', App.showResults);
			App.$doc.on('click', '#btnReturn', App.return);

            // Host
			App.$doc.on('click', '#btnCreateGame', App.createGame);
			App.$doc.on('click', '#btnStartGame', App.startGame);

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
		
		startGame: function () {
			if(App.players.length < 3){
				alert("Not enough players. Must have 6 to 12 players to start game.");
			}
			else if(App.players.length > 12){
				alert("Too many players. Must have 6 to 12 players to start game.");
			}
			else{
				IO.socket.emit('onStartGame',{roomCode: App.roomCode});
				//alert("Starting Game");
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

		// show waiting screen
		submitVote: function() {
			var selectedPlayer = $('#playerSelect').val();
            App.$gameArea.html(App.$waitingScreen);
			if(App.userRole == 'Host'){
				$('#btnEndRound').show();
			}
			else{
				$('#btnEndRound').hide();
			}
			IO.socket.emit('onSubmitVote',{roomCode: App.roomCode, vote: selectedPlayer, username: App.name});
        },

		// show vote totals
		showVoteTotals: function() {
			App.$gameArea.html(App.$voteTotalsScreen);
			App.doTextFit('.title');
			// display vote totals
			for (i = 0; i < App.voteCnts.length; i++) {
				$('#voteTotals').append('<br/>');
				$('#voteTotals').append(App.prevAlive[i]+": "+App.voteCnts[i]);
			}
        },

		// show results
		showResults: function() {
			App.$gameArea.html(App.$resultsScreen);
			App.doTextFit('.title');
			// display results
			$('#results').text('Players Remaining');
			for (i = 0; i < App.playersAlive.length; i++) {
				$('#results').append('<br/>');
				$('#results').append(App.playersAlive[i]);
			}
			$('#results').append('<br/>');
			$('#results').append("Players Eliminated this round: ");
			for (i = 0; i < App.playersElimed.length; i++) {
				$('#results').append('<br/>');
				$('#results').append(App.playersElimed[i]);
			}
			if(App.playersAlive.length>2){
				$('#btnReturn').text('Return to lobby');
			}
			else{
				$('#btnReturn').text('Next Round');
			}
        },
		

		// return button was pressed
		// sends player to lobby or to next round depending on players left alive
		return: function() {
			if(App.playersAlive.length<=2){
				// go back to lobby if two or less players are left
				if(App.userRole == 'Host'){
					App.$gameArea.html(App.$templateHostGameLobby);
					$('#hostRoomCode').text('Room Code: ');
					$('#hostRoomCode').append(App.roomCode);
				    App.doTextFit('.title');
				}
				else{
					//display the player's game lobby
		        	App.$gameArea.html(App.$templatePlayerGameLobby);
					$('#playerRoomCode').text('Room Code: ');
					$('#playerRoomCode').append(App.roomCode);
					App.doTextFit('.title');
				}
				App.updatePlayerList();
			}
			else{
				// start new round if more than two left
				if(App.playersAlive.includes(App.name)){
					// show voting area, if still alive
					playersDone = []; // empty players done list
					App.$gameArea.html(App.$templateVotingScreen);
					App.doTextFit('.title');
					App.updateVotingList();
				}
				else{
					//otherwise send to waiting screen
					App.$gameArea.html(App.$waitingScreen);
					App.updateWaitList()
				}
			}
			
        },
		

		

		// server initiated events

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

		// in response to player joining room on server side
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

		// occurs when server starts game for all players from host request
		initGame: function(){
			// show voting area
			playersDone = []; // empty players done list
			App.playersAlive = App.players; // reset players alive list
			App.$gameArea.html(App.$templateVotingScreen);
			App.doTextFit('.title');
			App.updateVotingList();
		},

		// occurs when server recieves a vote
		playerVoted: function(data){
			App.playersDone.push(data.playerDone);
			App.updateWaitList();
		},

		// server has recieved all votes for round. Display players actions
		dispPlayerActions: function(data) {
            App.$gameArea.html(App.$playerActionsScreen);
			App.doTextFit('.title');
			App.playersDone = []; // reset players done list
			App.prevAlive = App.playersAlive; // store players alive at beginning of round
			App.playersAlive = data.playersAlive; // update players alive list
			// save elims and vote counts for later
			App.playersElimed = data.playersElimed;
			App.voteCnts = data.voteCnts;
			// display all player actions
			for (i = 0; i < data.playerVotes.length; i++) {
				$('#actions').append('<br/>');
				$('#actions').append(App.prevAlive[i]+" voted for "+data.playerVotes[i]);
			}
			console.log('Player Votes: '+data.playerVotes);
        },
		
		error: function (data){
			alert(data.message);
			App.doTextFit('.title');
		},

		// helper functions, called by other functions in this file		
		
		// updates player list in lobby area
		updatePlayerList: function(){
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

		// updates player list in lobby area
		updateWaitList: function(){
			$('#waitList').text('Waiting For:');
			var i;
			for (i = 0; i < App.players.length; i++) {
				if(!App.playersDone.includes(App.playersAlive[i])){
					$('#waitList').append('<br/>');
					$('#waitList').append(App.playersAlive[i]);
				}
			}
		},

		// updates player voting list
		updateVotingList: function(){
			var i;
			for (i = 0; i < App.playersAlive.length; i++) {
				$('#playerSelect').append($('<option>', {
					value: App.playersAlive[i],
					text: App.playersAlive[i]
				}));
			}
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
