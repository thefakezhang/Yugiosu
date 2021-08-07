const Effect = require('./Effect');

class Card{

    constructor(id, title, type, max, desc, effect){
        this.id = id;
        this.title = title;
        if(type === "Spell"){
            this.type = 0;
        }else if(type === "Trap"){
            this.type = 3;
        }else if(type === "Gift Spell"){
            this.type = 2;
        }else if(type === "Cont. Spell"){
            this.type = 1;
        }else{
            this.type = -1;
        }
        this.max = max;
        this.desc = desc;
        this.effect = new Effect(effect);
    }

    

}

module.exports = Card;
