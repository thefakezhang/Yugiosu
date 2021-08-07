class Mappool{

    /**
     * 
     * @param {*} mappool a list of dictionaries containing the code and beatmap id of each pick
     */
    constructor(mappool){
        //each entry in pool will be {map code, map id, current effects}
        let pool = [];
        for(let pick of mappool){

            let code = pick["code"];
            let id = pick["id"];
            pool.push({"code": code, "id":id});

        }

        this.mappool = pool;
        this.p1Bans = [];
        this.p2Bans = [];
        this.p1Picks = [];
        this.p2Picks = [];
        this.currentPick = "";

        
        
    }

    /**
     * picks a map
     * @param {string} code code of the map
     * @param {boolean} currentPlayer1 whether the picking player is player1
     */
    pick(code, currentPlayer1){
        code = code.toUpperCase();
        //checks if this map is in any team's bans or pick history
        if ([...this.p1Bans, ...this.p2Bans, ...this.p1Picks, ...this.p2Picks].includes(code)){
            //throw a tantrum
            throw new Error("map has been banned or has already been picked");
        }

        //notes which team picked the map
        if(currentPlayer1){
            this.p1Picks.push(code);
        }else{
            this.p2Picks.push(code);
        }
        this.currentPick = code;
    }

    /**
     * determines whether a map is currently pickable/targetable by cards
     * @param {string} input the input string from the player
     * @returns boolean for whether input is a valid pick
     */
    checkValidPick(input){
        if([...this.p1Bans, ...this.p2Bans, ...this.p1Picks, ...this.p2Picks].includes(input.toUpperCase())){
            return false;
        }

        for(let map of this.mappool){
            if(input.toUpperCase() === map["code"].toUpperCase() || input.toUpperCase() === map["id"].toString()){
                return true;
            }
        }

        return false;
    }
}

module.exports = Mappool;