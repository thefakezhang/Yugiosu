from pickle import FALSE
from discord import guild
from redbot.core import commands
from redbot.core import data_manager
from redbot.core import checks
from redbot.core import Config
import discord
import json

class MyCog(commands.Cog):
    """My custom cog"""

    #bracket = json.load("tournaments.json")

    def __init__(self, bot):
        self.bot = bot
        self.config = Config.get_conf(self, 12345678)
        self.client = discord.Client()
        self.current_round = "R64"

        default_user = {
            "team": "NONE",
        }

        default_teams = {
            "exists": False, 

            "members":[], 

            "decks":{
                "R64":[], 
                "R32":[], 
                "R16":[], 
                "QF":[], 
                "SF":[], 
                "F":[], 
                "GF":[]
            }
        }

        self.config.register_user(**default_user)
        self.config.register_member(**default_user)
        self.config.init_custom("team", 1)
        self.config.register_custom("team", **default_teams)

    @commands.command()
    async def mycom(self, ctx):
        """This does stuff!"""
        # Your code will go here
        await ctx.send("I can do stuff!")

    @commands.command()
    async def myname(self, ctx, user: discord.Member = None):
        if user is None:
            user = ctx.author
        await ctx.send(
            "your name is {}".format(user.display_name)
        )

    @commands.command()
    @checks.is_owner()
    async def mydatapath(self, ctx):
        path = data_manager.cog_data_path(self)
        await ctx.send(
            "the data path is {} with type {}".format(path, data_manager.storage_type())
        )

    @commands.command()
    async def viewdeck(self, ctx):
        #fetches team name from user config
        teamname = await self.config.user(ctx.author).team()

        #checks if the player is on a team
        if(teamname == "NONE"):
            await ctx.send("you aren't on a team!")
            return

        #gets the appropriate round and retrieves the right deck
        d = await self.config.custom("team", teamname).decks()
        await ctx.send(
            "this is your deck:\n{}".format(d[self.current_round])
        )

    @commands.command()
    async def addcard(self, ctx, number:int):
        #runs a check if the card ID is within a set bound
        if  number > 500 or number < 1:
            await ctx.send("please don't try to add card IDs higher than 500!")
            return


        teamname = await self.config.user(ctx.author).team()

        #checks if the player is on a team
        if(teamname == "NONE"):
            await ctx.send("you aren't on a team!")
            return

        #retrives the appropriate deck list from the right team and the right round
        d = await self.config.custom("team", teamname).decks()
        current_deck = d[self.current_round]
        current_deck.append(number)
        d[self.current_round] = current_deck

        #writes the new deck into the team config
        await self.config.custom("team", teamname).decks.set(d)

        #sends a confirmation
        await ctx.send("{} has been added to your deck!".format(number))

    @commands.command()
    async def removecard(self, ctx, number:int):
        #fetches team name from user config
        teamname = await self.config.user(ctx.author).team()

        #checks if the player is on a team
        if(teamname == "NONE"):
            await ctx.send("you aren't on a team!")
            return

        #retrieves the deck with the appropriate round
        d = await self.config.custom("team", teamname).decks()
        current_deck = d[self.current_round]

        #attempts to remove the card from the deck
        try:
            current_deck.remove(number)
            d[self.current_round] = current_deck
        except:
            await ctx.send("Oops! Looks like you tried to remove a card that doesn't exist!")
            return

        #updates the team config with the new deck and sends a confirmation
        await self.config.custom("team", teamname).decks.set(d)
        await ctx.send("{} has been removed from your deck!".format(number))

    @commands.command()
    @checks.is_owner()
    async def wipe(self, ctx, teamname:str, round:str):
        
        """
        possible inputs for the round:
        R64
        R32
        R16
        QF
        SF
        F
        GF        
        """

        #checks if team exists
        team_exists = await self.config.custom("team", teamname).exists()
        if not team_exists:
            await ctx.send("the team doesn't exist!")
            return

        #wipes the team's deck for the specifc round
        d = await self.config.custom("team", teamname).decks()
        d[round] = []

        #writes the updated deck back into the config
        await self.config.custom("team", teamname).decks.set(d)
        
        #sends a confirmation
        await ctx.send("{}'s {} deck has been wiped!".format(teamname, round))


    @commands.command()
    @checks.is_owner()
    async def createteam(self, ctx, teamname:str):
        user = ctx.author
        await self.config.custom("team", teamname)

    @commands.command()
    @checks.is_owner()
    async def addmember(self, ctx, teamname:str, teammate:discord.Member):
        members = await self.config.custom("team", teamname).members()
        members.append(teammate.id)

        #checks if the team exists or not already. If not, create it
        team_exists = await self.config.custom("team", teamname).exists()
        if(not team_exists):
            await self.config.custom("team", teamname).exists.set(True)

        #write the new members list to the config
        await self.config.custom("team", teamname).members.set(members)

        #writes the name of the team into the config of the user
        await self.config.user(teammate).team.set(teamname)

        #sends confirmation
        await ctx.send("{} has been added to the team {}!".format(teammate.display_name, teamname))

    @commands.command()
    @checks.is_owner()
    async def changeround(self, ctx, round:str):
        """
        possible inputs for the round:
        R64
        R32
        R16
        QF
        SF
        F
        GF        
        """

        self.current_round = round
        await ctx.send("the current round has been changed to {}!".format(self.current_round))

    @commands.command()
    async def currentround(self, ctx):
        await ctx.send("the current round is {}".format(self.current_round))

    @commands.command()
    @checks.is_owner()
    async def removemember(self, ctx, teamname:str, teammate:discord.Member):
        #removes player from list
        members = await self.config.custom("team", teamname).members()

        try:
            members.remove(teammate.id)
        except:
            await ctx.send("Oops! Looks like you tried to remove a member that's not on team {}!".format(teamname))
            return

        #writes new members list into the config
        await self.config.custom("team", teamname).members.set(members)

        #wipes the team of a player from the config
        await self.config.user(teammate).team.set("NONE")

        #sends confirmation
        await ctx.send("{} has been removed from team {}".format(teammate, teamname))

    @commands.command()
    async def team(self, ctx, user:discord.Member = None):
        if user == None:
            user = ctx.author

        await ctx.send("{} is on team {}".format(user.display_name, await self.config.user(user).team()))

    @commands.command()
    async def viewmembers(self, ctx, teamname:str):
        #grabs the players from the team config
        team = await self.config.custom("team", teamname).members()
        membernames = []

        #converts player IDs into display names
        team_exists = await self.config.custom("team", teamname).exists()
        if(not team_exists):
            await ctx.send("team {} doesn't exist!".format(teamname))
            return

        for x in team:
            membernames.append(
                    (await ctx.author.guild.fetch_member(x)).name
                )
        await ctx.send("{} is composed of these members:\n{}".format(teamname, membernames))
