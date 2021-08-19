const Mappool = require('./Mappool');
const Deck = require('./Deck');
const EffectManager = require('./EffectManager');
const Card = require('./Card');

const PHASE = {
    PREP:-1,
    ROLLS:0,
    WARMUP:1,
    BANS:2,
    CARDS:3,
    PICK:4,
    PLAY:5
}


class Game{

    /**
     * constructor for a game of yugiosu
     * @param {int} startDraw how many cards each team can draw at the beginning of the game
     * @param {int} handSize max hand size, exceeding this will force them to discard until they are not over the max
     * @param {string} team1 name of the first team
     * @param {Card[]} cardList1 list of cards for the first team
     * @param {string} team2 name of the second team
     * @param {Card[]} cardList2 list of cards for the second team
     * @param {{code:string, id:int}[]} mappool the list of maps in the pool
     */
    constructor(startDraw, handSize, team1, cardList1, team2, cardList2, mappool, banCount){

        this.phase = PHASE.PREP;
        this.startDraw = startDraw;
        this.handSize = handSize;
        this.currentPlayer = null;
        this.mappool = new Mappool(mappool);
        this.cards = {};
        this.banCount = banCount;
        this.bans = {
            "BLUE":[],
            "RED":[]
        }
        this.banning = false;
        this.currentBanTeam = -1;

        this.toggle = {
            "HD":false,
            "HR":false,
            "DT":false,
            "EZ":false,
            "FL":false,
            "SD":false
        };

        this.wincon = "v2";

        this.player1 = {
            "name":team1, 
            "deck":new Deck(cardList1)
        };
        this.player1['deck'].stack = this.player1['deck'].shuffle(this.player1['deck'].cardList);

        this.player2 = {
            "name":team2, 
            "deck":new Deck(cardList2)
        };
        this.player2['deck'].stack = this.player2['deck'].shuffle(this.player2['deck'].cardList);


        this.playHistory = [];
        this.effectManager = new EffectManager(this.mappool);

        this.team1Roller = '';
        this.team1Roll = -1;
        this.team2Roller = '';
        this.team2Roll = -1;
        this.rollWinner = -1;

        this.teamWantsWarmups = [-1, -1];
        this.teamPlayedWarmups = [false, false];
        this.currentHostTeam = -1;
    }

    /**
     * starts the game by drawing the cards into each team's hand
     * @param {int} firstPlayer 0 = team 1, 1 = team 2
     */
    startGame(firstPlayer){

        //draws cards for both players to handsize
        for(let i = 0; i < this.startDraw; i++){
            this.player1["deck"].draw();
            this.player2["deck"].draw();
        }

        this.currentPlayer = (firstPlayer==0) ? this.player1 : this.player2;
    }

    /**
     * instantiates all the cards
     */
    loadCards(){
        let cards = require("C:\\Users\\Tony\\Desktop\\Programming\\Yugiosu\\Yugiosu - Python (Discord)\\yugiosu discord bot\\cogs\\Yugiosu\\cards.json");
        for(let card of cards){
            this.cards[card["id"]] = new Card(card['id'], card["name"], card["cardtype"], card["copies"], card["description"], card["properties"]);
        }
    }

    /**
     * plays the card from the player's hand
     * @param {int} index index of the card in the player's hand
     * @param {list} args additional args that the card may require
     */
    play(index, args = []){
        if(index >= this.currentPlayer["deck"].hand.length || index < 0){
            throw new Error("invalid Hand Index");
        }

        let card = this.cards[this.currentPlayer["deck"].removeFromHand(index)];
        this.effectManager.parse(card, (Object.is(this.currentPlayer, this.player1)) ? 1 : 0, args);
    }


    /**
     * picks a map and applies all necessary effects
     * @param {string} code the code of the map 
     */
    pick(code){
        //passes in the map code as well as if the current player is player1 (boolean)
        this.mappool.pick(code.toUpperCase(), Object.is(this.currentPlayer, this.player1));
        this.apply();
    }

    /**
     * 
     * @param {PHASE} phase the phase that one should change to
     */
    changePhase(phase){
        this.phase = phase;
    }

    /**
     * compares the rolls of both teams and gives the larger roll the right to decide picks/bans first.
     * Upon equal roll it will keep rollWinner at -1
     */
    compareRolls(){
        if(this.team1Roll != -1 && this.team2Roll != -1){
            if(this.team1Roll > this.team2Roll){
                this.rollWinner = 0;
            }else if(this. team1Roll < this.team2Roll){
                this.rollWinner = 1;
            }
        }
    }

    resetRollInfo(){
        this.team1Roll = -1;
        this.team2Roll = -1;
        this.team1Roller = '';
        this.team2Roller = '';
    }

    startBans(teamBanning){
        this.banning = true;
        this.currentBanTeam = teamBanning;
    }

    bansDone(){
        return this.bans['BLUE'].length == this.banCount && this.bans['RED'].length == this.banCount;
    }

    /**
     * apply any applicable effects to the gamestate, be it on an individual map or on the entire game
     */
    apply(){
        //applies global effects
        for(let effect of this.effectManager.globalEffects){
            let args = effect["command"].split(' ');
            switch(args[0]){
                case "TOGGLE":
                    this.toggle[args[1]] = !this.toggle[args[1]];
                    break;

                case "WINCON":
                    this.wincon = args[1];
                    break;
            }
        }

        //console.log(JSON.stringify(this.effectManager.localEffects));
        //console.log(this.mappool.currentPick);
        //console.log(this.effectManager.localEffects[this.mappool.currentPick]);

        //applies local effects if there are any to apply
        if(this.effectManager.localEffects[this.mappool.currentPick]){ //this statement is truthy or falsey
            console.log(`pick: ${this.mappool.currentPick}, local effects: ${JSON.stringify(this.effectManager.localEffects[this.mappool.currentPick])}`);

            //checks ONLY if the opposing team has any traps laid
            let opposingTeam = Object.is(this.currentPlayer, this.player1) ? 0 : 1 ;
            for(let effect of this.effectManager.localEffects[this.mappool.currentPick][opposingTeam]){
                let args = effect["command"].split(' ');
                switch(args[0]){
                    case "TOGGLE":
                        this.toggle[args[1]] = !this.toggle[args[1]];
                        break;
                    
                    case "WINCON":
                        this.wincon = args[1];
                        break;
                }
            }

            this.effectManager.localEffects[this.mappool.currentPick] = [];
        }
        
    }

    //ends the turn :3
    endTurn(){
        this.currentPlayer = (Object.is(this.currentPlayer, this.player1)) ? this.player2 : this.player1;
        this.currentPlayer["deck"].draw();
        this.toggle = {
            "HD":false,
            "HR":false,
            "DT":false,
            "EZ":false,
            "FL":false,
            "SD":false
        };

        this.wincon = "v2";

        for(let effect of this.effectManager.globalEffects){
            console.log(JSON.stringify(effect));
            if(effect["duration"] == 0){
                let index = this.effectManager.globalEffects.indexOf(effect);
                this.effectManager.globalEffects.splice(index, 1);
            }else{
                effect["duration"] = effect["duration"]-1;
            }
        }

    }
}

Game.PHASE = PHASE;
module.exports = Game;