class Deck{
    constructor(cardList){
        this.cardList = cardList;
        this.stack = []
        this.hand = [];
        this.graveyard = [];
    }

    /**
     * shuffles a deck
     * @param {int} cards the list of cards
     * @returns a copy of the cards in a random order
     */
    shuffle(cards){
        
        //creates a copy of the given cards
        let cpy = [...cards];
        for(let i = cpy.length-1; i > 0; i--){
            //find a random index j
            let j = Math.floor(Math.random() * (i+1));

            //swap cards[i] and cards[j]
            [cpy[i], cpy[j]] = [cpy[j], cpy[i]];
        }

        return cpy;
    }

    /**
     * draws the next card that is on top of the deck and places it into the hand
     */
    draw(){
        if(this.stack.length == 0){
            return -1;
        }
        let card = this.stack.pop();
        this.hand.push(card);
    }


    /**
     * removes the card at the selected index from hand
     * @param {int} index index of the card in the hand
     */
    removeFromHand(index){
        return this.hand.splice(index, 1)[0];
    }


}

module.exports = Deck;