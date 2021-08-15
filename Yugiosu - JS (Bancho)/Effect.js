class Effect{
    constructor(effect){
        //0 = team 0, 1 = team 1
        //this.whoPlayed = team;

        //-1 = undefined, 0 = self team, 1 = opponent team, 2 = entire lobby
        this.target = -1;

        //-1 = undefined, 0 = spell, 1 = continuous spell, 2 = gift spell, 3 = trap
        this.type = -1;

        //discard conditions: on pick, on win, on loss, on choice, 

        //false = inactive, true = active
        this.active = false;

        //I have no fucking clue how to start writing this
        //edit: I have no fucking clue how I wrote this
        //currently written in are default values
        this.properties = [
            {
                //Target? We don't really have a use for this rn.
                "target":"",
                //turn indicates what turn this effect takes place. 0 is THIS turn, 1 is the next team's turn, 2 is the turn after that, etc etc
                //turn of -1 indicates continuous effect
                "turn":0,
                //timing indicates when in a turn this effect takes place. (Relative to when the map is played)
                //Possible keywords are: "UNDEFINED","BEFORE","AFTER","IMMEDIATELY"
                "timing":"UNDEFINED",
                "effect":{
                    "takeInput": {
                        "active": false,
                        //Possible choosers are "SELF" and "OPPONENT"
                        "chooser": "SELF",
                        //Possible types are:
                        //"MOD","HANDINDEX","PLAYERSELFTEAM","PLAYEROPPONENTTEAM","MAP"
                        //"HANDINDEX" can only refer to the chooser's hand.
                        "type": "",
                        //New effect objects which implicitly access the solicited input
                        //for effects that expect input
                        "properties": []
                    },
                    "modToggleInput":{
                        "active":false,
                        //enables the mod specified by "takeInput"
                        "self":false,
                        "opponent":false
                    },
                    "addCardInput":{
                        "active":false,
                        //adds a copy of the card at "HANDINDEX" specified by "takeInput"
                        //if no card was specified then add nothing
                        "self":false,
                        "opponent":false
                    },
                    "removeCardInput":{
                        "active":false,
                        //removes the card at "HANDINDEX" specified by "takeInput"
                        //if no card was specified then remove nothing
                        "self":false,
                        "opponent":false
                    },
                    "forceMemberInput":{
                        "active":false,
                        //forces the member at either "PLAYERSELFTEAM" or "PLAYEROPPONENTTEAM" specified by "takeInput"
                        //to play the next "count" maps
                        //if "count"=-1, then the player chosen is forced to play all maps from then on
                        "count":0
                    },
                    "viewTrapInput":{
                        "active":false,
                        //views and reports the trap card at "MAP" specified by "takeInput"
                    },
                    "modToggle":{
                        //toggles mods
                        "active":false,
                        "self":false,
                        "opponent":false,
                        "mod":[]
                    },
                    "wincon":{
                        //sets win condition
                        "active":false,
                        "wincon":"v2"
                    },
                    "teamSize":{
                        //sets team sizes
                        //0 = full team
                        "active":false,
                        "self": 0,
                        "opponent": 0
                    },
                    "forceMember":{
                        "active":false,
                        /**
                         * POSSIBLE KEYWORDS:
                         * "CAPTAIN" - forces captain to play
                         * "RANDOM" - chooses a random player
                         * "CHOOSE" - the team may choose a player from the OTHER team
                         * 
                         * KEYWORDS ARE RESOLVED IN ORDER OF INPUT
                         * ex. ["RANDOM", "CHOOSE"] -> one opposing member is randomly chosen, and then self picks one player from the remaining members of the opponent team
                         *     ["CHOOSE", "RANDOM"] -> self picks one player from the opponent team, and then one member is randomly chosen from the remaining members of the opponent team 
                         */
                        //"CHOOSE" is chosen by the OPPOSING team
                        "self": [],
                        //"CHOOSE" is chosen by the SELF team
                        "opponent":[]
                    },
                    "scoreMultiplier":{
                        "active": false,
                        /**
                         * self and opponent are lists of dictionaries with the entries {"keyword":<keyword>, "multiplier":<float>}
                         * 
                         * POSSIBLE KEYWORDS:
                         * "CAPTAIN" - gives the captain of the given team a score multiplier
                         * "RANDOM" - chooses a random player
                         * "CHOOSE" - the team may choose a player from your OWN team
                         * "ALL" - any member that plays the map on the team
                         * 
                         * ex. self:[{"keyword":"CHOOSE", "multiplier":1.3}] allows self team to choose a player to give a 1.3 score multiplier to
                         */
                        "self": [],
                        "opponent": []
                    },
                    "pointReward":{
                        //determines how many points are rewarded upon a win for the map pick
                        "active":false,
                        "self":1,
                        "opponent":1
                    },
                    "changePoints":{
                        //determines how many points to add (can take negatives) to each team
                        "active":false,
                        "self":0,
                        "opponent":0
                    },
                    "exodia":{
                        //exodia
                        "active":false,
                        //Display is 0, Keyboard is 1, and Tablet is 2
                        "number":-1
                    },
                    "draw":{
                        "active":false,
                        "self":0,
                        "opponent":0
                    },
                    "discard":{
                        //all discard effects are selected by the team discarding
                        "active":false,
                        "self":0,
                        "opponent":0
                    },
                    "mill":{
                        "active":false,
                        //mills self deck
                        "self":0,
                        //mills opponent deck
                        "opponent":0
                    },
                    "comb":{
                        "active":false,
                        //self searches self deck for a number of cards and places them on top of the deck
                        //the first card chosen is, at the end of the effect resolving, on the very top,
                        //the second card chosen right below the first, and so on.
                        "self":0,
                        //opponent searches opponent deck for a number of cards and places them on top of the deck
                        "opponent":0
                    },
                    "shuffle":{
                        "active":false,
                        "self":false,
                        "opponent":false
                    },
                    "counterSpell":{
                        "active":false,
                        //self team can disable up to "count" number of spells that opponent team played that turn
                        "count":0
                    },
                    "boostMap":{
                        "active":false,
                       /**
                        * boost is a list of dictionaries with the entries {"keyword", "multiplier"}
                        * 
                        * POSSIBLE KEYWORDS:
                        * "CAPTAIN" - forces captain to play
                        * "RANDOM" - chooses a random player
                        * "CHOOSE" - the team may choose a player from your OWN team
                        * "ALL" - any member that plays the map on the team
                        * 
                        * ex. self:[{"keyword":"CHOOSE", "multiplier":1.3}] allows self team to choose a player to give a 1.3 score multiplier to as long as the selected map isn't picked
                        */
                        "boost":[]
                    },
                    "ban":{
                        "active":false,
                        /**
                         * POSSIBLE KEYWORDS:
                         * "TOPSCORE" - disregard whether this keyword is in "self" or "opponent," if this shows up in either, then the LOBBY topscore will be banned
                         * "CHOOSE" - this team may choose a member of the other team to ban
                         * 
                         * FORMAT: 
                         * duration is an integer that defines the duration of the ban. -1 indicates a PERMANENT BAN
                         * {"keyword":<insert keyword>,"duration":<int>}
                         * 
                         * In the following example:
                         * "self":[{"keyword":"TOPSCORE", "duration":2}]
                         * "opponent":[{"keyword":"CHOOSE", "duration":-1}]
                         * 
                         * the opponent may choose a player from self's team to ban permanently, and the LOBBY topscore will be banned for the duration of 2 maps
                         */
                        "self":[],
                        "opponent":[]
                    },
                    "comparator":{
                        "active":false,
                        /**
                         * conditionals is a dictionary of {"target":<"SELF" or "OPPONENT">, "keyword":<some keyword>, "negation":<boolean>, "compare":<some comparator>, "value":<*>, "properties":<a new Effect object>}
                         * 
                         * 
                         * POSSIBLE TARGETS:
                         * "SELF":this tells the comparator that it's looking for a self action
                         * "OPPONENT":this tells the comparator that it's looking for an opponent action
                         * "EITHER": either self or opponent
                         * 
                         * POSSIBLE KEYWORDS:
                         * "ROLL <int>":value of the target's roll (where they are rolling <int>)
                         * "PICK":the target pick
                         * "CAPTAINCHAT":specifically reading in the messages of the target team's captain
                         * "CHAT":reading in messages of the target team
                         * "TEAMSCORECHECK": checks the score ratio of the target team
                         * "INDIVSCORECHECK": checks the score of a given player
                         * "SCORERATIOCHECK": checks the score ratio of (target team)/(other team)
                         * "DISCARD":checks whether target has discarded a card. Gives 1 if true and 0 if false
                         * "CARDMAPPICKED":checks whether target has picked the map that this card was placed on. Gives 1 if true and 0 if false
                         * "EXODIA": checks whether an "exodia" effect with "number":0 and an "exodia" effect with "number":1 have already been activated. Gives 1 if true and 0 if false
                         * 
                         * 
                         * POSSIBLE NEGATIONS:
                         * "true": negates the comparator
                         * "false": does not negate the comparator
                         * 
                         * POSSIBLE COMPARES:
                         * ">":greater than
                         * "<":less than
                         * ">=":greater or equal to
                         * "<=":less than or equal to
                         * "==":equal to
                         * "CONTAINS":
                         *      on "ROLL" keyword: takes in a variable number of integers and checks if the roll contains said integers ex. OPPONENT ROLL 100 CONTAINS 5 7 checks opponent roll 100 and checks for 5s or 7s in the resulting roll
                         *      on "PICK" keyword: takes in a mod name (ex. HD, HR, EZ) and checks if the pick contains said mod ex. SELF PICK CONTAINS HD checks if self pick is HD
                         *      on "CHAT" related keywords: takes in a phrase, and checks if the read in messages contain the phrase
                         * "TOPSCORE": WORKS ONLY WITH "INDIVSCORECHECK"!!! Checks if the selected player topscores the lobby
                         * 
                         * When given the same keyword with different comparisons, the game will not prompt the keyword twice (ex. if you have 2 "ROLL 3" keywords, it'll only prompt once)
                         * 
                         */
                        "conditionals":[]
                    },
                    "disableCondition":{
                        "active":false,
                        /**
                         * Similar structure as comparator, except this dictates when this card is disabled. The effect key in the dictionary specifies effects to carry out after disabling
                         * 
                         * ADDITIONAL FEATURES:
                         * 
                         * ADDITIONAL KEYWORDS:
                         * "ANYTIME": target may at ANY TIME during the match. Ignores negations, compares, and values
                         */
                        "conditionals":[]
                    },
                    "pickban":{
                        //whether self team can pick a banned map
                        "active":false
                    },
                    "markMapPlayed":{
                        //marks a map(s) as played
                        "active":false,
                        /**
                         * POSSIBLE KEYWORDS:
                         * "CURRENT" - marks the current map as played
                         * "RANDOM" - marks a random unplayed map as played
                         * "CHOOSE" - the team may choose an unplayed map to mark as played
                         *
                         * KEYWORDS ARE RESOLVED IN ORDER OF INPUT, BUT "CURRENT" CANNOT BE IN A LIST WITH OTHER KEYWORDS
                         **/
                        "maps":[]
                    },
                    "changePickOrder":{
                        "active": false,
                        //"order" is a binary string, where 0 is self pick, 1 is opponent pick. It specifies the pick order to insert after the map that this effect is played on, 
                        //and then continues with "101010..."
                        "order":"1010"
                    },
                    "randomizer":{
                        //plays a random card?
                        "active":false
                    },
                    "addMap":{
                        //restrictions: less than 12*, 310>length>60
        
                        "active":false,
                        //self adds a new map (code EX) and any mod combination and wincon
                        "self":0,
                        //opponent adds a new map (code EX) that allows and any mod combination and wincon
                        "opponent":0
                    },
                    "repick":{
                        //makes target pick another map as their pick
                        "active":false,
                        "self":false,
                        "opponent":false
                    },
                    "forceMap":{
                        "active":false,
                        /**
                         * forces the opponent to choose from an existing set
                         * 
                         * EXISTING KEYWORDS:
                         * "PREVMAP" - the map that was previously picked by the other team. ONLY WORKS WITH CARD ID 20
                         */
                        "keyword": ""
                    },
                    "NiaphNipah":{
                        "active":false
                        //does the NiaphNipah thingy
                    }
        
        
            }
        }];

        this.properties = effect;

    }

  

    //example for card ID 1: self.target = 2, self.type = 0, self.timing = 0, self.effect = {"modToggle": {"active":true, "mod":["HD"]}...}

    //example for card ID 11: self.target = 2, self.type = 2, self.timing = 0, self.effect = {..."teamSize":{"active":true, "team 1": 1, "team 2": 1}}

    //example for card ID 42: self.target = 2, self.type = 0, self.timing = 2, 
    //  self.effect = {..."forceMember":{"active":true, "self":["CAPTAIN"], "opponent":["CAPTAIN"]} 
    //                  "scoreMultiplier":{"active":true, "self": 1.0, "opponent":1.3}}

    //example for card ID 10: self.target = 2, self.type = 2, self.
    
}

module.exports = Effect;