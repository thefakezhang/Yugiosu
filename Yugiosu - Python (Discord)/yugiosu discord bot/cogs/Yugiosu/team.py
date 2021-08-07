class Team:

    def __init__(self, *args) -> None:
        if len(args) > 0:
            self.seed = args[0]
            self.users = args[1]
            self.deck = args[2]
            self.tournament_id = args[3]
        else:
            self.seed = 0
            self.users = []
            self.deck = {}
            self.tournament_id = 0
    
