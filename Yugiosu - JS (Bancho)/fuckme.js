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
const config = require('./config.json');
const pool = require('./pool.json');
const match = require('./match.json');

const client = new bancho.BanchoClient(config);
const api = new nodesu.Client(config.apiKey);

let channel, lobby;

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
let game = new Game(startDraw, handSize, team1, cardList1, team2, cardList2, mappool);

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
      if (match.teams[BLUE].members.includes(id)) {
        lobby.changeTeam(obj.player, "Blue");
      } else if (match.teams[RED].members.includes(id)) {
        lobby.changeTeam(obj.player, "Red");
      } else {
        console.log(chalk.red("Warning! Couldn't figure out team"));
      }
  
      if (obj.player.user.isClient()) {
        lobby.setHost("#" + obj.player.user.id);
      }
     });
  
    lobby.on("allPlayersReady", (obj) => {
      lobby.startMatch(10);
    });
  
    lobby.on("matchFinished", (scores) => {
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
    });
  
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
     

      //PLAYER COMMANDS
      switch(game.phase){
        case Game.PHASE.PREP:
          
          break;
        case Game.PHASE.ROLLS:
          
          break;
        case Game.PHASE.WARMUP:
          
          break;
        case Game.PHASE.BANS:
          
          break;
        case Game.PHASE.CARDS:
          
          break;
        case Game.PHASE.PICK:
          // people on the picking team can choose just by saying the map name/code
          if (auto && match.teams[match.picking].members.includes(msg.user.id)) {
            const map = setBeatmap(msg.message);
            if (map) console.log(chalk.cyan(`Changing map to ${map}`));
          }
          break;
        case Game.PHASE.PLAY:
          
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
  await lobby.closeLobby();
  await client.disconnect();
  console.log(chalk.cyan("Closed."));
}

function setBeatmap(input, force=false) { 
    let isCode = !isNaN(input.slice(-1)); //is a numbered map code like NM2, DT1, etc.
    if (force || input.length > 4 || (input.length > 2 && isCode)) {
      
      const codeResult = pool.filter((map) => {
        return map.code.toLowerCase() === input.toLowerCase();
      });
  
      //checks if it's a beatmap ID (basically checks if input is integers only)
      const result = pool.filter((map) => {
        if(input.match(/^[0-9]+$/) != null){
            return map.id.toLowerCase().includes(input.toLowerCase());
        }
        
      });
  
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


