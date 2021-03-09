// title: app.js
// by: Jacob Torchia
// Description: client side javascript for the DeadLast game,
// all incoming signals from host are handled by the IO section
// client side messaging to host, displaying pages and button presses
// are handled by then App section
// Code based off of github guide and repo at the below address: 
// https://github.com/FrontenderMagazine/building-multiplayer-games-with-node-js-and-socket-io/blob/master/eng.md
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
			IO.socket.on('playerAmbushed',App.playerAmbushed);
			IO.socket.on('ambushOver',App.dispAmbushSummary);
			IO.socket.on('playerShowed',App.playerShowed);
			IO.socket.on('showdownOver',App.showdownOver);
			IO.socket.on('gameOver',App.gameOver);
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
		
		// alive players
		prevPlayersAlive : [],

		//players who have voted
		playersDone : [],

		//player votes for the current round
		playerVotes : [],

		//players who got eliminated this round
		playersElimed : [],

		// number of gold pieces per player
		goldPieces : [],

		// total value of players gold tokens
		goldValue : [],
		
		// list of players who succesfully ambushed
		ambushingPlayers: [],

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
			App.$resultsScreen = $('#results-screen-template').html();
			App.$ambushScreen = $('#ambush-screen-template').html();
			App.$ambushWaitScreen = $('#ambush-waiting-screen-template').html();
			App.$ambushSummaryScreen = $('#ambush-summary-screen-template').html();
			App.$showdownScreen = $('#showdown-screen-template').html();
			App.$showdownWaitScreen = $('#showdown-waiting-screen-template').html();
			App.$showdownSummaryScreen = $('#showdown-summary-screen-template').html();
			App.$winnerScreen = $('#winner-screen-template').html();
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
			App.$doc.on('click', '#btnViewResults', App.showResults);
			App.$doc.on('click', '#btnContinue', App.continue);
			App.$doc.on('click', '#btnStartAmbush', App.ambush);
			App.$doc.on('click', '#btnSubmitAmbush', App.submitAmbush);
			App.$doc.on('click', '#btnStartShowdown', App.startShowdown);
			App.$doc.on('click', '#btnSubmitShowdown', App.submitShowdown);
			App.$doc.on('click', '#btnNextRound', App.continue);
			App.$doc.on('click', '#btnGetResults', App.showResults);
			App.$doc.on('click', '#btnReturnLobby', App.returnLobby);

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
			// open site window with instructions on how to play
			window.open("https://www.ultraboardgames.com/dead-last/game-rules.php", "_blank"); 
            //App.$gameArea.html(App.$templateHowToPlay);
            //App.doTextFit('.title');
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

		// occurs when btnSubmitVote is pressed, get player's vote and send it to the server
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

		// show results
		showResults: function() {
			App.$gameArea.html(App.$resultsScreen);
			// display results
			$('#results').text('Players Remaining');
			for (i = 0; i < App.playersAlive.length; i++) {
				$('#results').append('<br/>');
				$('#results').append(App.playersAlive[i]);
			}
			$('#results').append('<br/>');
			$('#results').append('<br/>');
			$('#results').append("Players Eliminated this round: ");
			for (i = 0; i < App.playersElimed.length; i++) {
				$('#results').append('<br/>');
				$('#results').append(App.playersElimed[i]);
			}

			$('#results').append('<br/>');
			$('#results').append('<br/>');
			$('#results').append("Gold pieces of each player: ");
			for (i = 0; i < App.goldPieces.length; i++) {
				$('#results').append('<br/>');
				$('#results').append(App.players[i]+": "+App.goldPieces[i]);
			}
			
			if(App.playersAlive.length==2){
				$('#btnContinue').hide();
				$('#results').append('<br/>');
				$('#results').append('2 players left, prepare for a showdown!');
			}
			else{
				$('#btnStartShowdown').hide();
				if(App.playersAlive.length>1){
					$('#btnContinue').text('Continue');
				}
				else{
					$('#btnContinue').text('New Round');
				}
			}
        },
		
		// continue button was pressed
		// sends players to next round
		continue: function() {
			if(App.playersAlive.length<=1){
				//if one or less players left, then round is over
				// reset the players alive list
				App.playersAlive = App.players;
			}
			// continue voting if game is not over
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
        },

		// if there is a succesful ambush, this occurs after displaying player actions
		ambush: function() {
			if(App.ambushingPlayers.includes(App.name)){
				// if player is an ambusher, show them ambush screen
				App.$gameArea.html(App.$ambushScreen);
				var targetCnt = 0;
				// allow ambusher to select any player that voted for them
				console.log('Players Alive at beginning of round: '+App.prevPlayersAlive);
				console.log('Player Votes: '+App.playerVotes);
				console.log('Player Name: '+App.name);
				for (var i = 0; i < App.prevPlayersAlive.length; i++) {
					if((App.prevPlayersAlive[i] !== App.name)&&(App.playerVotes[i]==App.name)&&(App.playersAlive.includes(App.prevPlayersAlive[i]))){
						// if player is not the user, the player voted for the user and the player is alive, then they are a target
						targetCnt++; //increment target counter
						$('#ambushSelect').append($('<option>', {
							value: App.prevPlayersAlive[i],
							text: App.prevPlayersAlive[i]
						}));
					}
				}
				if(targetCnt==0){
					// if player has no valid ambush targets, list targets as not available
					$('#ambushSelect').append($('<option>', {
						value: 'Ambush',  //player name cannot be Ambush, so this is the null, no target player vote value
						text: 'No Targets'
					}));
				}
			}
			else{
				// otherwise, send player to waiting room
				App.$gameArea.html(App.$ambushWaitScreen);
				// update the waiting list
				App.updateAmbushWaitList();
			}
		},

		// occurs when btnSubmitAmbush is pressed, get ambush selection and send it to the server
		submitAmbush: function() {
			var selectedPlayer = $('#ambushSelect').val();
            App.$gameArea.html(App.$ambushWaitScreen);
			if(App.userRole == 'Host'){
				$('#btnEndAmbush').show();
			}
			else{
				$('#btnEndAmbush').hide();
			}
			IO.socket.emit('onSubmitAmbush',{roomCode: App.roomCode, vote: selectedPlayer, username: App.name});
        },
		
		// occurs when btnStartShowdown is pressed
		startShowdown: function() {
			if(App.playersAlive.includes(App.name)){
				// if player is alive, they are a part of the showdown. 
				// show the showdown selection screen
				App.$gameArea.html(App.$showdownScreen);

				// add options to showdown selection
				$('#showdownSelect').append($('<option>', {
					value: 'grab',
					text: 'grab'
				}));
				$('#showdownSelect').append($('<option>', {
					value: 'share',
					text: 'share'
				}));
				$('#showdownSelect').append($('<option>', {
					value: 'steal',
					text: 'steal'
				}));
			}
			else{
				// if not alive, then show the waiting screen
				App.$gameArea.html(App.$showdownWaitScreen);
				if(App.userRole == 'Host'){
					$('#btnEndShowdown').show();
				}
				else{
					$('#btnEndShowdown').hide();
				}
				App.updateShowdownWaitList();
			}
        },

		// occurs when btnSubmitShowdown is pressed, get showdown selection and send it to the server
		submitShowdown: function() {
			var selectedAction = $('#showdownSelect').val();
            App.$gameArea.html(App.$showdownWaitScreen);
			if(App.userRole == 'Host'){
				$('#btnEndShowdown').show();
			}
			else{
				$('#btnEndShowdown').hide();
			}
			IO.socket.emit('onSubmitShowdown',{roomCode: App.roomCode, action: selectedAction, username: App.name});
			App.updateShowdownWaitList();
        },

		// from winner screen, return to lobby has been pressed
		returnLobby: function() {
			if(App.userRole == 'Host'){
				App.$gameArea.html(App.$templateHostGameLobby);
				// update the player list
				$('#hostRoomCode').text('Room Code: ');
				$('#hostRoomCode').append(App.roomCode);
			    App.doTextFit('.title');
			}
			else{
				//display the game's lobby
            	App.$gameArea.html(App.$templatePlayerGameLobby);
				$('#playerRoomCode').text('Room Code: ');
				$('#playerRoomCode').append(App.roomCode);
				App.doTextFit('.title');
			}
			App.updatePlayerList();
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
			App.playersDone = []; // empty players done list
			App.playersAlive = App.players; // reset players alive list
			App.$gameArea.html(App.$templateVotingScreen);
			App.doTextFit('.title');
			App.updateVotingList();
		},

		// occurs when server recieves a vote
		// data = {playerDone:}
		playerVoted: function(data){
			App.playersDone.push(data.playerDone);
			App.updateWaitList();
		},

		// occurs when server recieves ambush target
		// data = {ambushingPlayers:}
		playerAmbushed: function(data){
			App.ambushingPlayers = data.ambushingPlayers;
			App.updateAmbushWaitList();
		},

		// occurs when server recieves showdown action
		// data = {player:}
		playerShowed: function(data){
			App.playersDone.push(data.player);
			App.updateShowdownWaitList();
		},

		// a player has won, display the winner's name(s)
		// data = {winners: ,goldValue:}
		gameOver: function(data) {
			console.log('First Winner: '+ data.winners[0]);
			App.$gameArea.html(App.$winnerScreen);
			$('#winner').append(data.winners[0]);
			for (i = 1; i < data.winners.length; i++) {
				$('#winner').append(' and ');
				$('#winner').append(data.winners[i]);
			}
			if(data.winners.length>1){
				$('#winner').append(' have tied!');
			}
			else{
				$('#winner').append(' has won!');
			}
			$('#winner').append('<br/>');
			$('#winner').append('<br/>')
			
			$('#finalGold').append('Final Gold Value: ');
			for (i = 0; i < App.players.length; i++) {
				$('#finalGold').append('<br/>');
				$('#finalGold').append(App.players[i]+': '+data.goldValue[i]);
			}
        },

		// server has recieved all ambushes
		// data = {ambushSummary: , playersAlive: , goldPieces: }
		dispAmbushSummary: function(data) {
			// show ambush summary screen
			App.$gameArea.html(App.$ambushSummaryScreen);
			App.doTextFit('.title');
			App.playersAlive = data.playersAlive;
			App.goldPieces = data.goldPieces;
			for (i = 0; i < data.ambushSummary.length; i++) {
				if(data.ambushSummary[i].target == 'Ambush'){
					$('#ambushSummary').append(data.ambushSummary[i].ambusher +' had no targets to ambush');
				}
				else{
					$('#ambushSummary').append(data.ambushSummary[i].ambusher +' ambushed '+ data.ambushSummary[i].target);
				}
				$('#ambushSummary').append('<br/>');
				if(!App.playersElimed.includes(data.ambushSummary[i].target)){
					// add targeted player to elimed list if not already there
					if(data.ambushSummary[i].target !== 'Ambush'){
						// the target must not be 'Ambush' since this is a null target, when there is no valid target available
						App.playersElimed.push(data.ambushSummary[i].target);
					}
				}
			}
			// clear ambushing players list
			App.ambushingPlayers = [];
		},

		// server has recieved all votes for round. Display players actions
		dispPlayerActions: function(data) {
            App.$gameArea.html(App.$playerActionsScreen);
			App.doTextFit('.title');
			App.playersDone = []; // reset players done list
			// save elims for displaying results
			App.playersElimed = data.playersElimed;
			// save gold pieces for displaying results
			App.goldPieces = data.goldPieces;
			// save player votes for ambush case
			App.playerVotes = data.playerVotes;
			// display players who were majority vote
			$('#actions').append(App.playersAlive[data.majorityVoteIdxs[0]]);
			for (i = 1; i < data.majorityVoteIdxs.length; i++) {
				$('#actions').append(' and ');
				$('#actions').append(App.playersAlive[data.majorityVoteIdxs[i]]);
			}
			if(data.majorityVoteIdxs.length>1){
				$('#actions').append(' were the majority vote with '+data.maxVote+' votes');
			}
			else{
				$('#actions').append(' was the majority vote with '+data.maxVote+' votes');
			}

			// store ambushing players
			App.ambushingPlayers = data.ambushingPlayers;
			if(data.ambushingPlayers.length>0){
				// if there was a succesful ambush
				$('#actions').append('<br/>');
				$('#actions').append(data.ambushingPlayers[0]);
				for (i = 1; i < data.ambushingPlayers.length; i++) {
					$('#actions').append(' and ');
					$('#actions').append(data.ambushingPlayers[i]);
				}
				$('#actions').append(' ambushed successfully');
				// hide the view results button if there is ambush
				$('#btnViewResults').hide();
			}
			else{
				// otherwise hide the ambush button
				$('#btnStartAmbush').hide();
			}

			$('#actions').append('<br/>');
			// display all player actions
			for (i = 0; i < data.playerVotes.length; i++) {
				$('#actions').append('<br/>');
				if(data.playerVotes[i] !== 'Ambush'){
					$('#actions').append(App.playersAlive[i]+" voted for "+data.playerVotes[i]);
				}
				else{
					$('#actions').append(App.playersAlive[i]+" chose Ambush");
				}
			}
			// store players alive at beginning of round for ambush
			App.prevPlayersAlive = App.playersAlive;
			App.playersAlive = data.playersAlive; // update players alive list
			console.log('Player Votes: '+data.playerVotes);
        },

		// occurs when every player has finished the showdown
		// data = {showdownSummary:, goldPieces:}
		showdownOver: function (data){
			App.$gameArea.html(App.$showdownSummaryScreen);
			App.doTextFit('.title');
			for (i = 0; i < data.showdownSummary.length; i++) {
				$('#showdownSummary').append(data.showdownSummary[i].player+' chose '+data.showdownSummary[i].action);
				$('#showdownSummary').append('<br/>');
			}
			
			if((data.showdownSummary[0].action =='steal')&&(data.showdownSummary[1].action=='steal')){
				// if both players chose steal
				$('#showdownSummary').append('<br/>');
				$('#showdownSummary').append('Everyone but '+data.showdownSummary[0].player+' and '+data.showdownSummary[1].player+' received 1 gold piece');
				$('#showdownSummary').append('<br/>');
			}
			else{
				$('#showdownSummary').append('<br/>');
				for (i = 0; i < data.showdownSummary.length; i++) {
					$('#showdownSummary').append(data.showdownSummary[i].player+' recieved '+data.showdownSummary[i].goldGiven+' gold pieces');
					$('#showdownSummary').append('<br/>');
				}
			}

			$('#showdownSummary').append('<br/>');
			// update the gold pieces
			App.goldPieces = data.goldPieces;
			$('#showdownSummary').append("Gold pieces of each player: ");
			for (i = 0; i < App.goldPieces.length; i++) {
				$('#showdownSummary').append('<br/>');
				$('#showdownSummary').append(App.players[i]+": "+App.goldPieces[i]);
			}
			// consider everyone eliminated after showdown, for continue() to work correctly
			App.playersAlive = [];
			App.playersDone = []; // empty players done list
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

		// updates player list in voting wait area
		updateWaitList: function(){
			$('#waitList').text('Waiting For:');
			var i;
			for (i = 0; i < App.players.length; i++) {
				if(!App.playersDone.includes(App.playersAlive[i])){
					// if a living player is not done voting the display their name in waitlist
					$('#waitList').append('<br/>');
					$('#waitList').append(App.playersAlive[i]);
				}
			}
		},

		// updates player list in ambush wait area
		updateAmbushWaitList: function(){
			$('#ambushWaitList').text('Waiting For:');
			var i;
			for (i = 0; i < App.ambushingPlayers.length; i++) {
				// display players who still need to choose ambush targets
				$('#ambushWaitList').append('<br/>');
				$('#ambushWaitList').append(App.ambushingPlayers[i]);
			}
		},

		// updates player list in showndown wait area
		updateShowdownWaitList: function(){
			$('#showdownWaitList').text('Waiting For:');
			for (var i = 0; i < App.players.length; i++) {
				if(!App.playersDone.includes(App.playersAlive[i])){
					// if a living player is not done voting the display their name in waitlist
					$('#showdownWaitList').append('<br/>');
					$('#showdownWaitList').append(App.playersAlive[i]);
				}
			}
		},

		// updates player voting list
		updateVotingList: function(){
			$('#playerSelect').append($('<option>', {
				value: 'Ambush',
				text: 'Ambush'
			}));
			var i;
			for (i = 0; i < App.playersAlive.length; i++) {
				if(App.playersAlive[i] !== App.name){
					$('#playerSelect').append($('<option>', {
						value: App.playersAlive[i],
						text: App.playersAlive[i]
					}));
				}
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
