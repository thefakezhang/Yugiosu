const bancho = require('bancho.js');
const chalk = require('chalk');
const nodesu = require('nodesu');
const fs = require('fs');
const Game = require('./Game.js');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//team/player data will be acquired through a shared json file with the discord bot. 
//The discord bot will store all information about matches (teams, times, etc) and inform this bot when a match is happening
//AKA don't think about that right now


const BLUE = 0, RED = 1;
const TEAM1 = 0, TEAM2 = 1, OTHER = 2;
const config = require('../../config.json');
const pool = require('./pool.json');
const match = require('./match.json');
const wait = (time) => {
  let d = new Date();
  let d2 = null;
  do{
    d2 = new Date();
  }while(d2-d < time)
}

const client = new bancho.BanchoClient(config);
const api = new nodesu.Client(config.apiKey);


let channel; 
let lobby;
let attemptedHost;
let playersInLobby = [[],[],[]]; //team 1 players, team 2 players, guests

match.winningScore = Math.ceil(match.BO/2);
match.score = [0, 0]; 
match.picking = 0;

let auto = false;
let currentPick = "None";

let startDraw = 5;
let handSize = 7;
let team1 = match.teams[BLUE].name;
let team2 = match.teams[RED].name;
let mappool = require('./pool.json');
let cardList1 = [1,2,3,4,1];  
let cardList2 = [1,2,3,4,1];
let game = new Game(startDraw, handSize, team1, cardList1, team2, cardList2, mappool, match.bans);

//TODO: have this match.json structured in a way that requires the reporting of every tangible action so that the discord bot has the option of using it
//sidenote: what happens when you use this to write data into a redbot config? does it break?

async function init() {
    console.log(chalk.bold.cyan('Starting osu!autoref'));
    //await initPool();
    //console.log(chalk.bold.green('Loaded map pool!'));
    console.log(chalk.cyan('Attempting to connect...'));
    
    try {
      await client.connect();
      console.log(chalk.bold.green("Connected to Bancho!"));
      channel = await client.createLobby(`${match.tournament}: ${match.teams[BLUE].name} vs ${match.teams[RED].name}`);
    } catch (err) {
      console.log(err);
      console.log(chalk.bold.red("Failed to create lobby"));
      process.exit(1);
    }
  
    lobby = channel.lobby;

    const password = Math.random().toString(36).substring(8);
    await lobby.setPassword(password);
    await lobby.setMap(43117); //More wenches and mead!
  
    console.log(chalk.bold.green("Lobby created!"));
    console.log(chalk.bold.cyan(`Name: ${lobby.name}, password: ${password}`));
    console.log(chalk.bold.cyan(`Multiplayer link: https://osu.ppy.sh/mp/${lobby.id}`));
    console.log(chalk.cyan(`Open in your irc client with "/join #mp_${lobby.id}"`));

    //adding referees and streamers as refs so they can see stuff
    for(let i = 0; i < match.referees.length; i++){
        const user = await client.getUserById(match.referees[i].toString());
        setTimeout(() => lobby.addRef(user.username), 1000);
        //await lobby.addRef(user.username);
        console.log(chalk.bold.greenBright(`added ${user.username} as a referee!`));
    }
    for(let i = 0; i < match.streamers.length; i++){
        const user = await client.getUserById(match.streamers[i].toString());
        setTimeout(() => lobby.addRef(user.username), 1000);
        console.log(chalk.bold.greenBright(`added ${user.username} as a streamer!`));
    }
  
    lobby.setSettings(bancho.BanchoLobbyTeamModes.TeamVs, bancho.BanchoLobbyWinConditions.ScoreV2);
    
    createListeners();
    game.startGame(match.picking);
    game.loadCards();
  }

  function createListeners() {
    lobby.on("playerJoined", (obj) => {
      const id = obj.player.user.id;
      console.log(chalk.yellow(`Player ${id} has joined!`));
  
      // Attempt to auto-assign team
      if (match.teams[TEAM1].members.includes(id)) {
        lobby.changeTeam(obj.player, "Blue");
        playersInLobby[TEAM1].push(id);
      } else if (match.teams[TEAM2].members.includes(id)) {
        lobby.changeTeam(obj.player, "Red");
        playersInLobby[TEAM2].push(id);
      } else {
        console.log(chalk.red("Warning! Couldn't figure out team"));
        playersInLobby[OTHER].push(id);
      }
  
      if (obj.player.user.isClient()) {
        //let p = lobby.setHost("#" + obj.player.user.id);
      }
     });

    

    lobby.on("playerLeft", (obj) => {
      const id = obj.user.id;
      //console.log(`object keys for leaving player: ${Object.keys(obj.user)}`);

      if (match.teams[TEAM1].members.includes(id)) {
        playersInLobby[TEAM1].splice(playersInLobby[TEAM1].indexOf(id), 1);
      } else if (match.teams[TEAM2].members.includes(id)) {
        playersInLobby[TEAM2].splice(playersInLobby[TEAM2].indexOf(id), 1);
      } else {
        playersInLobby[OTHER].splice(playersInLobby[OTHER].indexOf(id), 1);
      }

      switch(game.phase){
        case Game.PHASE.WARMUP: //if a player leaves during warmups phase while they were the host, it could cause some trouble. We try to manage it here
          if(lobby.getHost() == undefined || (game.currentHostTeam != -1 
          && !match.teams[game.currentHostTeam].members.includes(lobby.getHost().user.id))){ //if the new host is not on the team that is currently playing warmups
            if(playersInLobby[game.currentHostTeam].length > 0){

              attemptedHost = playersInLobby[game.currentHostTeam][0];
              game.teamPlayedWarmups[game.currentHostTeam] = true;
              lobby.setHost("#" + playersInLobby[game.currentHostTeam][0]);

            }else{ //...there are no players from the team playing warmups in the lobby...?
              channel.sendMessage("it seems like... there's no one from the team currently playing warmups in the lobby...?");
              channel.sendMessage("I guess we're skipping their warmups...");
              game.currentHostTeam = 1-game.currentHostTeam;

              if(game.teamWantsWarmups[game.currentHostTeam] && !game.teamPlayedWarmups[game.currentHostTeam]){ //if the other team wants warmups and hasn't played them
                
                attemptedHost = playersInLobby[game.currentHostTeam][0];
                game.teamPlayedWarmups[game.currentHostTeam] = true;
                lobby.setHost("#" + playersInLobby[game.currentHostTeam][0]);
                channel.sendMessage("!mp timer 90");
                
              }else{
                channel.sendMessage("moving onto the ban stage!");
                channel.sendMessage("!mp timer 90");
                channel.sendMessage("!mp clearhost");
                game.currentHostTeam = -1;
                channel.sendMessage(`team ${game.rollWinner+1}, please say \'ban first\' or \'ban second\' to indicate which ban order you prefer!`);
                game.changePhase(Game.PHASE.BANS);
              }

            } 
          }
          break;
      }
    });
  
    lobby.on("allPlayersReady", (obj) => {
      lobby.startMatch(10);
    });
  
    lobby.on("matchFinished", (scores) => {

      switch(game.phase){
        case Game.PHASE.WARMUP:
          console.log(`currenthost: ${game.currentHostTeam}, other team wants warmups: ${game.teamWantsWarmups[1 - game.currentHostTeam]}`);
          console.log(`other team played warmups: ${game.teamPlayedWarmups[1 - game.currentHostTeam]}, other team: ${playersInLobby[1 - game.currentHostTeam]}`)
          if(game.teamWantsWarmups[1 - game.currentHostTeam] && !game.teamPlayedWarmups[1 - game.currentHostTeam] 
            && playersInLobby[1 - game.currentHostTeam].length > 0){ //if the other team wants warmups and hasn't played yet

            game.currentHostTeam = 1 - game.currentHostTeam; 
            attemptedHost = playersInLobby[game.currentHostTeam][0];
            game.teamPlayedWarmups[game.currentHostTeam] = true;
            lobby.setHost("#" + playersInLobby[game.currentHostTeam][0]);
            channel.sendMessage("!mp timer 90");
          
          }else{
            channel.sendMessage("Warmup phase complete! Moving onto the bans phase!");
            channel.sendMessage("!mp clearhost");
            game.currentHostTeam = -1;
            channel.sendMessage("!mp timer 90");
            channel.sendMessage(`team ${game.rollWinner+1}, please say \'ban first\' or \'ban second\' to indicate which ban order you prefer!`);
            game.changePhase(Game.PHASE.BANS);
          }
          break;

        case Game.PHASE.PLAY:
          match.playHistory.push([currentPick, match.picking]);
          fs.writeFileSync("./match.json", JSON.stringify(match));
          game.endTurn();
          if (auto) {  
            let s = {"Blue": 0, "Red": 0};
            scores.forEach((score) => {
              s[score.player.team] += score.pass * score.score;
            });
      
            let diff = s["Blue"] - s["Red"];
            //TODO: ENABLE THIS OR WRITE YOUR OWN THING FOR HANDLING SCORING
            // if (diff > 0) {
            //   channel.sendMessage(`${match.teams[BLUE].name} wins by ${diff}`);
            //   match.score[BLUE]++;
            // } else if (diff < 0) {
            //   channel.sendMessage(`${match.teams[RED].name} wins by ${-diff}`);
            //   match.score[RED]++;
            // } else {
            //   channel.sendMessage("It was a tie!");
            // }
      
            match.picking = 1 - match.picking;
            printScore();
      
            if (match.score[BLUE] >= match.winningScore) {
              channel.sendMessage(`${match.teams[BLUE].name} has won the match!`);
            } else if (match.score[RED] >= match.winningScore) {
              channel.sendMessage(`${match.teams[RED].name} has won the match!`);
            } else if (match.score[BLUE] === match.winningScore - 1 && match.score[RED] === match.winningScore - 1) {
              channel.sendMessage("It's time for the tiebreaker!");
      
              // bug: after match ends, need to wait a bit before changing map
              setTimeout(() => setBeatmap('TB', true), 2000);
            } else {  
              promptPick();
            }
          }
          break;
      }

          
    });

    lobby.on("host", (obj) => {
      let id = (obj === null || obj === undefined) ? null : obj.user.id;
      if(attemptedHost != null && attemptedHost === id){
        attemptedHost = null; //stub
      }
    })

    
  
    channel.on("message", async (msg) => {
      // All ">" commands must be sent by host OR referee
      console.log(chalk.dim(`${msg.user.ircUsername}: ${msg.message}`));
      if (msg.message.startsWith(">") && (msg.user.ircUsername === config.username || match.referees.includes(msg.user.id))) { // if it is host OR referee
        const m = msg.message.substring(1).split(' ');
        console.log(chalk.yellow(`Received command "${m[0]}"`));
  
        switch (m[0]) {
          case 'close':
            await close();
            break;
          case 'invite':
            const players = match.teams[0].members.concat(match.teams[1].members)
            for (const p of players) {
              // intentionally fire these synchronously
              const user = await client.getUserById(p);
              await lobby.invitePlayer(user.username);
            }
            break;
          case 'map':
            const map = setBeatmap(m.slice(1).join(' '), true);
            if (map) console.log(chalk.cyan(`Changing map to ${map}`));
            break;
          case 'play':
            console.log(chalk.green(`attempting to play the ${parseInt(m[1])}th card"`));

            if(m.length > 2){
              game.play(parseInt(m[1]), m.slice(2));
            }else{
              game.play(parseInt(m[1]));
            }
            break;
          case 'view':

            if (match.teams[BLUE].members.includes(msg.user.id)) {
              channel.sendMessage(`Blue team's hand: ${game.player1['deck'].hand}`);
            } else if (match.teams[RED].members.includes(msg.user.id)) {
              channel.sendMessage(`Red team's hand: ${game.player2['deck'].hand}`);
            } else {
              channel.sendMessage(`Bruh you're not on a team!`);
            }
            break;
          case 'phase':
            let phase = parseInt(m[1]);
            game.changePhase(phase);
            break;
          case 'score':
            match.score[0] = parseInt(m[1]);
            match.score[1] = parseInt(m[2]);
            printScore();
            break;
          case 'auto':
            auto = (m[1] === 'on');
            channel.sendMessage("Auto referee is " + (auto ? "ON" : "OFF"));
            if (auto) promptPick(); 
            break;
          case 'picking':
            match.picking = (m[1].toLowerCase() === "red" ? 1 : 0);
            if (auto) promptPick();
            break;
          case 'ping':
            channel.sendMessage("pong");
            break;
          default:
            console.log(chalk.bold.red(`Unrecognized command "${m[0]}"`));
        }
      } 
     
      const m = msg.message.split(' ');
      //console.log(chalk.yellow(`Received command "${m[0]}"`));
      //PLAYER COMMANDS
      switch(game.phase){ //TODO add a prompt asking both teams if they're ready.
        case Game.PHASE.PREP:
          switch(m[0]){
            case 'next':
              game.changePhase(Game.PHASE.ROLLS);
              channel.sendMessage("going into rolls phase...");
              channel.sendMessage("the first roll from any player from either team will be taken as the team roll. Roll when you're ready!");
              channel.sendMessage("!mp timer 45");
              break;
          }
          break;
        case Game.PHASE.ROLLS:
          switch(m[0]){
            case '!roll':
              if(m.length == 2 && m[1].match('^[0-9]+$') && parseInt(m[1]) != 100){ //player is trying to roll out of something other than 100
                channel.sendMessage(`${msg.user.ircUsername} is trying to roll out of something other than 100! bad boy!`);
                break;
              } 

              if(match.teams[0].members.includes(msg.user.id)){ //team 1 just rolled
                game.team1Roller = msg.user.ircUsername;
              }else if(match.teams[1].members.includes(msg.user.id)){ //team 2 just rolled
                game.team2Roller = msg.user.ircUsername;
              }else{ //someone on neither team just rolled

              }
              break;

            case game.team1Roller:
              channel.sendMessage("recording team 1's roll...");
              //console.log(`username: ${msg.user.ircUsername}, second message: ${m[1]}, team2roll: ${game.team1Roll}`);
              if(msg.user.ircUsername == 'BanchoBot' && m[1] === 'rolls' && game.team1Roll == -1){ //checks that this is from bancho and that the team hasn't rolled yet
                game.team1Roll = parseInt(m[2]);
                if(game.team2Roll != -1){ //if game has already recieved the other team's roll, move to next phase
                  game.compareRolls();
                  
                  if(game.rollWinner == -1){ //if rolls are equal, will have to repeat
                    channel.sendMessage(`blimey! It looks like both teams rolled the same number! Roll again...`);
                    game.resetRollInfo();
                    break;
                  }else{
                    channel.sendMessage(`team 1 rolled ${game.team1Roll} and team 2 rolled ${game.team2Roll}! Team ${game.rollWinner+1} wins the roll!`);
                  }

                  game.changePhase(Game.PHASE.WARMUP);
                  channel.sendMessage("going into warmups phase...");
                  channel.sendMessage("Would each team like to play a warmup? Please respond with \'yes\' or \'no\'.");
                  channel.sendMessage("!mp timer 45");
                }
              }
              break;
            
            case game.team2Roller:
              channel.sendMessage("recording team 2's roll...");
              //console.log(`username: ${msg.user.username}, second message: ${m[1]}, team2roll: ${game.team2Roll}`);
              if(msg.user.ircUsername == 'BanchoBot' && m[1] === 'rolls' && game.team2Roll == -1){ //checks that this is from bancho and that the team hasn't rolled yet
                game.team2Roll = parseInt(m[2]);
                if(game.team1Roll != -1){ //if game has already recieved the other team's roll, move to next phase
                  game.compareRolls();

                  if(game.rollWinner == -1){ //if rolls are equal, will have to repeat
                    channel.sendMessage(`blimey! It looks like both teams rolled the same number! Roll again...`);
                    game.resetRollInfo();
                    break;
                  }else{
                    channel.sendMessage(`team 1 rolled ${game.team1Roll} and team 2 rolled ${game.team2Roll}! Team ${game.rollWinner+1} wins the roll!`);
                  }

                  game.changePhase(Game.PHASE.WARMUP);
                  channel.sendMessage("going into warmups phase...");
                  channel.sendMessage("Would each team like to play a warmup? Please respond with \'yes\' or \'no\'.");
                  channel.sendMessage("!mp timer 45");
                }
              }
              break;  
            
            case 'Countdown':
              if(msg.user.ircUsername == 'BanchoBot'){
                if(m[1] === 'finished'){ //if one or both teams don't finish rolling by the countdown
                  channel.sendMessage(`the timer has finished! If a team hasn't rolled yet, their roll will default to 0`);
                  if(game.team1Roll == -1 && game.team2Roll == -1){ //in the event that neither team rolled...
                    channel.sendMessage(`it seems like neither team has rolled... Now randomly assigning winner...`)
                    game.rollWinner = Math.floor(Math.random() * 2);
                  }
  
                  if(game.team1Roll == -1){ //if ONLY team 1 didn't roll
                    game.team1Roll = 0;
                    game.compareRolls();
                  }
  
                  if(game.team2Roll == -1){ //if ONLY team 2 didn't roll
                    game.team2Roll = 0;
                    game.compareRolls();
                  }
  
                  channel.sendMessage(`team 1 rolled ${game.team1Roll} and team 2 rolled ${game.team2Roll}! Team ${game.rollWinner+1} wins the roll!`);
                  game.changePhase(Game.PHASE.WARMUP);
                  channel.sendMessage("going into warmups phase...");
                  channel.sendMessage("Would each team like to play a warmup? Please respond with \'yes\' or \'no\'.");
                  channel.sendMessage("!mp timer 45");
                }
              }
              
          }
          break;
        case Game.PHASE.WARMUP:
          //console.log("warmup command recieved: " + m[0]);

          switch(m[0].toLowerCase()){
            case 'yes':
              //console.log(`message user id: ${msg.user.id}`);
              if(match.teams[0].members.includes(msg.user.id) && game.teamWantsWarmups[0] == -1){ //team 1 said yes as the first response
                game.teamWantsWarmups[0] = 1;
              }else if(match.teams[1].members.includes(msg.user.id) && game.teamWantsWarmups[1] == -1){ //team 2 said yes as the first response
                game.teamWantsWarmups[1] = 1;
              }

              if(game.teamWantsWarmups[1] != -1 && game.teamWantsWarmups[0] != -1 
                && !(game.teamPlayedWarmups[0] || game.teamPlayedWarmups[1])){ //assigns host to the appropriate team (assumes at least one team says yes)

                channel.sendMessage("!mp aborttimer");    

                channel.sendMessage("changing host...");
                if(game.teamWantsWarmups[game.rollWinner] == 1){

                  attemptedHost = playersInLobby[game.rollWinner][0];
                  game.currentHostTeam = game.rollWinner;
                  game.teamPlayedWarmups[game.rollWinner] = true;
                  lobby.setHost("#" + playersInLobby[game.rollWinner][0]); 
                  channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                  channel.sendMessage("!mp timer 90");
                  
                }else{  
      
                  attemptedHost = playersInLobby[1 - game.rollWinner][0];
                  game.currentHostTeam = 1 - game.rollWinner;
                  game.teamPlayedWarmups[1 - game.rollWinner] = true;
                  lobby.setHost("#" + playersInLobby[1 - game.rollWinner][0]); 
                  channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                  channel.sendMessage("!mp timer 90");
                  
                }
              }
              break;

            case 'no':
              if(match.teams[0].members.includes(msg.user.id) && game.teamWantsWarmups[0] == -1){ //team 1 said no as the first response
                game.teamWantsWarmups[0] = 0;
              }else if(match.teams[1].members.includes(msg.user.id) && game.teamWantsWarmups[1] == -1){ //team 2 said no as the first response
                game.teamWantsWarmups[1] = 0;
              }

              if(game.teamWantsWarmups[1] != -1 && game.teamWantsWarmups[0] != -1
                && !(game.teamPlayedWarmups[0] || game.teamPlayedWarmups[1])){ //assigns host to the appropriate team (assumes at least one team says no)
                
                channel.sendMessage("!mp aborttimer");    

                if(game.teamWantsWarmups[game.rollWinner] == 1){

                  attemptedHost = playersInLobby[game.rollWinner][0];
                  game.currentHostTeam = game.rollWinner;
                  game.teamPlayedWarmups[game.rollWinner] = true;
                  lobby.setHost("#" + playersInLobby[game.rollWinner][0]); 
                  channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                  channel.sendMessage("!mp timer 90");

                }else if(game.teamWantsWarmups[1 - game.rollWinner] == 1){  

                  attemptedHost = playersInLobby[1 - game.rollWinner][0];
                  game.currentHostTeam = 1 - game.rollWinner;
                  game.teamPlayedWarmups[1 - game.rollWinner] = true;
                  lobby.setHost("#" + playersInLobby[1 - game.rollWinner][0]); 
                  channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                  channel.sendMessage("!mp timer 90");

                }else{
                  channel.sendMessage("nobody wants warmups D:");
                  channel.sendMessage("moving into the bans phase");
                  channel.sendMessage("!mp timer 90");
                  channel.sendMessage(`team ${game.rollWinner+1}, please say \'ban first\' or \'ban second\' to indicate which ban order you prefer!`);
                  game.changePhase(Game.PHASE.BANS);
                }
              }
              break;
            case 'countdown':
              if(msg.user.ircUsername == 'BanchoBot'){
                if(m[1] === 'finished'){
                  //console.log(`team 1: ${game.teamPlayedWarmups[0]}, team 2: ${game.teamPlayedWarmups[1]}`)
  
                  if(game.teamWantsWarmups[0] == -1 || game.teamWantsWarmups[1] == -1){ //one of the teams didn't decide to play warmups in time
                    //default to no
  
                    channel.sendMessage("one or both of the teams did not decide in time");
  
                    if(game.teamWantsWarmups[0] == -1){
                      game.teamWantsWarmups[0] = 0;
                    }
  
                    if(game.teamWantsWarmups[1] == -1){
                      game.teamWantsWarmups[1] = 0;
                    }
  
                    if(game.teamWantsWarmups[game.rollWinner] == 1){
                      
                      attemptedHost = playersInLobby[game.rollWinner][0];
                      game.currentHostTeam = game.rollWinner;
                      game.teamPlayedWarmups[game.rollWinner] = true;
                      lobby.setHost("#" + playersInLobby[game.rollWinner][0]); 
                      channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                      channel.sendMessage("!mp timer 90");
  
                    }else if(game.teamWantsWarmups[1 - game.rollWinner] == 1){ 
  
                      attemptedHost = playersInLobby[1 - game.rollWinner][0];
                      game.currentHostTeam = 1 - game.rollWinner;
                      game.teamPlayedWarmups[1 - game.rollWinner] = true;
                      lobby.setHost("#" + playersInLobby[1 - game.rollWinner][0]); 
                      channel.sendMessage("You have 90 seconds to pick a map for warmups!");
                      channel.sendMessage("!mp timer 90");
  
                    }else{
                      channel.sendMessage("no one wants warmups D:");
                      channel.sendMessage("moving into the ban phase");
                      channel.sendMessage("!mp clearhost");
                      game.currentHostTeam = -1;
                      channel.sendMessage("!mp timer 90");
                      channel.sendMessage(`team ${game.rollWinner+1}, please say \'ban first\' or \'ban second\' to indicate which ban order you prefer!`);
                      game.changePhase(Game.PHASE.BANS);
                    }
                  }else if(game.teamPlayedWarmups[0] || game.teamPlayedWarmups[1]){ //one of the teams didn't pick a map in time
                    channel.sendMessage("Time is up! Starting the map!");
                    lobby.startMatch(10);
                  }
                 
                }
              }
              
              break;
          }
          break;
        case Game.PHASE.BANS:
          //console.log(m);
          //console.log(`$game.banning: ${game.banning}`);
          switch(m[0].toLowerCase()){
            case 'ban':
              //only runs right before players start picking bans
              if(!game.banning){
                if(match.teams[game.rollWinner].members.includes(msg.user.id)){
                  if(m[1].toLowerCase() === 'first'){
                    game.startBans(game.rollWinner);
                    channel.sendMessage(`!mp timer 120`);
                    channel.sendMessage(`team ${game.currentBanTeam+1}! Please say the name or id of the map you want to ban! \'NM1\' or \'1492011\' for example!`);
                  }else if(m[1].toLowerCase() === 'second'){
                    game.startBans(1 - game.rollWinner);
                    channel.sendMessage(`!mp timer 120`);
                    channel.sendMessage(`team ${game.currentBanTeam+1}! Please say the name or id of the map you want to ban! \'NM1\' or \'1492011\' for example!`);
                  }else{
                    channel.sendMessage(`unable to parse your input, please respond with either \'ban first\' or \'ban second\'!`);
                  }
                }
              }

            case 'countdown': 
              if(msg.user.ircUsername == 'BanchoBot'){
                if(m[1] === 'finished'){
                  if(!game.banning){ //if a team doesnt pick whether to ban first or second before timer
                    channel.sendMessage(`team ${game.rollWinner + 1} did not choose the ban order in time! Ban order being assigned randomly...`);
                    game.startBans(Math.floor(Math.random() * 2));
                    channel.sendMessage(`the first team to ban has been randomly decided to be team ${game.currentBanTeam+1}!`);
                    channel.sendMessage(`!mp timer 120`);
                    channel.sendMessage(`Please say the name or id of the map you want to ban! \'NM1\' or \'1492011\' for example!`);
                  }else{ //if a player is currently banning but doesn't pick in time
                    channel.sendMessage(`team ${game.currentBanTeam + 1} did not choose their ban in time! Their ban will be voided!`);
                    const currentBanTeam = game.currentBanTeam == 0? `BLUE` : 'RED';
                    game.bans[currentBanTeam].push('NA');
                    game.currentBanTeam = 1 - game.currentBanTeam;
                    
                    if(!game.bansDone()){
                      channel.sendMessage(`it is now team ${game.currentBanTeam + 1}'s turn to ban!`);
                      channel.sendMessage(`!mp timer 120`);
                    }else{
                      channel.sendMessage(`ban phase is now over! Moving onto the main phase!!`);
                      game.changePhase(Game.PHASE.CARDS);
                    }
  
                  }
                }
              } 
          }

          //should not require commands, just map picks. Only activates when players are actually banning maps
          if(!game.bansDone()){
            if(game.banning){
              if(match.teams[game.currentBanTeam].members.includes(msg.user.id)){

                [validMap, codeResult, result] = parseForBeatmap(m[0], force = false);
                if(validMap){
                  // Prioritize matches to map code before checking by name
                  let map;
                  if (codeResult.length === 1) {
                    map = codeResult[0];
                  }  else if(result.length === 1) {
                    map = result[0];
                  } else {
                    channel.sendMessage(`This map doesn't exist! Please pick another map!`);
                    return;
                  }
  
                  const currentBanTeam = game.currentBanTeam == 0? `BLUE` : 'RED';
  
                  if(game.bans['BLUE'].includes(map.code) || game.bans['RED'].includes(map.code)){
                    channel.sendMessage(`That map has already been banned! Please pick another map!`);
                  }else{
                    game.bans[currentBanTeam].push(map.code);
                    channel.sendMessage(`team ${game.currentBanTeam + 1} has banned ${map.code}!`);
                    game.currentBanTeam = 1 - game.currentBanTeam;
                    if(!game.bansDone()){
                      channel.sendMessage(`it is now team ${game.currentBanTeam + 1}'s turn to ban!`);
                      channel.sendMessage(`!mp timer 120`);
                    }  
                  }
  
                }else if(m.length == 1){
                  channel.sendMessage(`that isn't a valid map! Please type the name or id of the map you want to ban!`);
                }
              }
            }
            
          }else{ //bans are done
            channel.sendMessage(`Ban phase is now done! Moving onto the main phase!!`);
            game.changePhase(Game.PHASE.CARDS);
            channel.sendMessage(`!mp aborttimer`);
          }
          break;
        case Game.PHASE.CARDS:
          switch(m[0]){
            case 'next':
              game.changePhase(Game.PHASE.PICK);
              break;
          }
          break;
        case Game.PHASE.PICK:
          // people on the picking team can choose just by saying the map name/code
          if (auto && match.teams[match.picking].members.includes(msg.user.id)) {
            const map = setBeatmap(msg.message);
            if (map) console.log(chalk.cyan(`Changing map to ${map}`));
          }
          break;
        case Game.PHASE.PLAY:
          switch(m[0]){
            case 'abort':
              //TODO: abort the map if its within time restraints
              break;
          }
          break;        
      }
      
    });
  }

  function printScore() {
    channel.sendMessage(`${match.teams[0].name} ${match.score[0]} -- ${match.score[1]} ${match.teams[1].name}`);
  }

  function promptPick() {
    channel.sendMessage(`${match.teams[match.picking].name}, pick the next map`);
  }
  
  async function close() {
  console.log(chalk.cyan("Closing..."));
  rl.close();
  lobby.closeLobby();
  client.disconnect();
  console.log(chalk.cyan("Closed."));
}

function parseForBeatmap(input, force=false){
  let isCode = !isNaN(input.slice(-1)); //is a numbered map code like NM2, DT1, etc.
  
  if (force || input.length > 4 || (input.length > 2 && isCode)) {
      
    const codeResult = pool.filter((map) => { // 
      return map.code.toLowerCase() === input.toLowerCase();
    });

    //checks if it's a beatmap ID (basically checks if input is integers only)
    const result = pool.filter((map) => {
      if(input.match(/^[0-9]+$/) != null){
          return map.id.toLowerCase().includes(input.toLowerCase());
      }
      
    });

    return [true, codeResult, result];
  }
    
  return [false, null, null];
}

function setBeatmap(input, force=false) { 
    const [validMap, codeResult, result] = parseForBeatmap(input, force);
  
    if (validMap) {
      // Prioritize matches to map code before checking by name
      let map;
      if (codeResult.length === 1) {
        map = codeResult[0];
      }  else if(result.length === 1) {
        map = result[0];
      } else {
        return;
      }

      let pickedBefore = false;
      for(let i = 0; i < match.playHistory.length; i++){
          pick = match.playHistory[i];
          if(pick[0] === map.code){
              pickedBefore = true;
          }
      }
    
      if(!pickedBefore){
        // Find correct mods based on map code
        game.pick(map.code);
        let mapType = map.code.slice(0, 2);
        let mod = '';

        if (map.mod) {
          game.toggle[map.mod] = !game.toggle[map.mod]; // if mod explicitly provided (not normal)
        } else if (['HD', 'HR', 'DT'].includes(mapType)) {
          game.toggle[mapType] = !game.toggle[mapType];
        } else if (mapType === 'NM') {
          //mod = 'NF';
      }
        
        if(game.toggle["HD"]){
          mod += 'HD';
        }
        if(game.toggle["HR"]){
          mod += ' HR';
        }
        if(game.toggle["DT"]){
          mod += ' DT';
        }
        if(game.toggle["EZ"]){
          mod += ' EZ';
        }
        if(game.toggle["FL"]){
          mod += ' FL';
        }
        if(game.toggle["SD"]){
          mod += ' SD';
        }else{
          mod += ' NF';
        }

        switch(game.wincon){
          case "v2":
            lobby.setSettings(bancho.BanchoLobbyTeamModes.TeamVs, bancho.BanchoLobbyWinConditions.ScoreV2);
            break;

          case "v1":
            lobby.setSettings(bancho.BanchoLobbyTeamModes.TeamVs, bancho.BanchoLobbyWinConditions.Score);
            break;

          case "acc":
            lobby.setSettings(bancho.BanchoLobbyTeamModes.TeamVs, bancho.BanchoLobbyWinConditions.Accuracy);
            break;

          case "combo":
            lobby.setSettings(bancho.BanchoLobbyTeamModes.TeamVs, bancho.BanchoLobbyWinConditions.Combo);
            break;

        }

        
    
        channel.sendMessage("Selecting " + map.code);
        lobby.setMap(map.id);
        lobby.setMods(mod, false);
        currentPick = map.code;
        return map.code;
      }else{
          channel.sendMessage(`${map.code} has been picked before! Please try another map!`);
      }
    }
  }

  rl.on('line', (input) => {
    channel.sendMessage(input);
  });

  init()
  .then(() => {
    console.log(chalk.bold.green("Initialization complete!"));
  })


