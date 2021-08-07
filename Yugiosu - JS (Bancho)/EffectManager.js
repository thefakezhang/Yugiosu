const Mappool = require("./Mappool");

const cardtype = {
    NONE:-1,
    SPELL:0,
    CONT:1,
    GIFT:2,
    TRAP:3
}

class EffectManager{
    /**
     * 
     * @param {Mappool} mappool the mappool used by the game
     */
    constructor(mappool){
        this.globalEffects = [];
        this.localEffects = {};
        this.mappool = mappool;
    }


    /**
     * 
     * @param {Card} card 
     * @param {int} teamPlayed the team that played the card. Blue = 0, Red = 1
     * @param {list} args optinal arguments that the specific card may require
     */
    parse(card, teamPlayed, args = []){
        let cardProperties = card.effect.properties;
        //console.log("cardProperties: " + JSON.stringify(cardProperties));
        switch(card.type){
            case cardtype.SPELL:
                //console.log("this is a spell card!");
                for(let property of cardProperties){
                    let turn = property["turn"];
                    let timing = property["timing"];
                    console.log(`${JSON.stringify(property["effect"])}`);
                    for(let effect in property["effect"]){
                        switch(effect){
                            case "modToggle":
                                let mods = property["effect"]["modToggle"]["mod"];
                                for(let mod of mods){
                                    this.globalEffects.push({
                                        "command": "TOGGLE " + mod,
                                        "duration": turn
                                    });
                                }
                                break;
                        }
                        
                    }
        
                }
                break;
            case cardtype.TRAP:
                //invariant: ALL trap cards must have args[0] be the map pick
                let map = args[0].toUpperCase();
                if(!this.mappool.checkValidPick(map)){
                    throw new Error(`${map} is not a valid map pick!!\n${JSON.stringify(this.mappool.mappool)}`);
                }

                if(!this.localEffects[map]){
                    this.localEffects[map] = {
                        0:[],
                        1:[]
                    };
                }

                for(let property of cardProperties){
                    let turn = property["turn"];
                    let timing = property["timing"];
                    let target = property["target"];

                    for(let effect in property["effect"]){
                        switch(effect){
                            case "modToggle":
                                let mods = property["effect"]["modToggle"]["mod"];
                                for(let mod of mods){
                                    this.localEffects[map][teamPlayed].push({
                                        "command": "TOGGLE " + mod,
                                        "target": target,
                                        "duration": turn
                                    });
                                }
                                break;
                        }
                    }
                    

                }
                break;
        }

        //console.log(`global: ${this.globalEffects}\nlocal: ${JSON.stringify(this.localEffects)}`);

    }
}

module.exports = EffectManager;