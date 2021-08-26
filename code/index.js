const express = require('express');
const fs = require('fs');

const mustacheExpress = require('mustache-express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const router = require('express').Router();

const app = express();
app.set('views', `${__dirname}/views`);
app.set('view engine', 'mustache');
app.engine('mustache', mustacheExpress());

app.use(bodyParser.json())

const defaultGameType = "usar";

const defaultGameConfig = {
    maxScore: 15,
    timeouts: 3,
    timeoutLength: 30,
    technicals: 2,
    appeals: 3
};

const defaultTieBreakerGameConfig = {
    maxScore: 11,
    timeouts: 2,
    timeoutLength: 30,
    technicals: 2,
    appeals: 2
};

const gameConfig = {
    usar: [
        defaultGameConfig,
        defaultGameConfig,
        defaultTieBreakerGameConfig
    ]
};

const blankGame = {
    id: 0,
    logo: "cvra",
    player1: {
        name: "",
        timeoutsRemaining: 0,
        appealsRemaining: 0,
        technicals: 0,
        score1: 0,
        score2: 0,
        score3: 0,
        score4: 0,
        score5: 0
    },

    player2: {
        name: "",
        score1: 0,
        score2: 0,
        score3: 0,
        score4: 0,
        score5: 0
    },

    config: defaultGameType,
    server: "player1",
    game: 1
};

const state = {
    games: {}
};

const gameStateFile = './gameinfo/state.json';

const gameSaver = setInterval(() => {
    const data = JSON.stringify(state.games);
    fs.writeFile(gameStateFile, data, function (err) {
        if (err) {
          console.log('There has been an error saving your game state data.');
          console.log(err.message);
          return;
        }
        console.log('Game state saved successfully.')
      });
      
}, 5*60*1000);

function restoreGameState() {
    try {
        const data = fs.readFileSync(gameStateFile);
        state.games = JSON.parse(data);
    } catch (e) {
        console.log('Error restoring game state', e);
    }
}

function getGame(id) {
    let gameInfo = state.games[id];
    if (!gameInfo) {
        gameInfo = JSON.parse(JSON.stringify(blankGame));
        gameInfo.created = Date.now();
    }

    gameInfo.id = id;
    return gameInfo;
};

function updateGame(id, updatedInfo) {
    const gameInfo = getGame(id);
    newGameInfo = Object.assign(gameInfo, updatedInfo);
    newGameInfo.lastModified = Date.now();
    newGameInfo.id = id;
    state.games[id] = newGameInfo;
    return newGameInfo;
}

router.get('/', (req, res) => {
    const newId = uuidv4();
    res.redirect(`/scoreboard/game/${newId}`);
});

router.get('/game/:id', (req, res) => {
    const gameInfo = getGame(req.params.id);
    res.render('scoreboard', gameInfo);
});

router.get('/api/game/:id', (req, res) => {
  const gameInfo = getGame(req.params.id);
  res.json(gameInfo);
});


router.post('/api/game/:id', (req, res) => {
    const newGameInfo = updateGame(req.params.id, req.body); 
    console.log("POST", req.body)
    res.json(newGameInfo);
  });

  router.post('/api/game/:id/game', (req, res) => {
    const gameInfo = getGame(req.params.id);
    
    gameInfo.game += 1;
    const gameSetting = gameConfig[gameInfo.config || "usar"][gameInfo.game - 1];
    gameInfo.player1.timeoutsRemaining = gameSetting.timeouts;
    gameInfo.player1.appealsRemaining = gameSetting.appeals;
    gameInfo.player1.technicals = 0;

    gameInfo.player2.timeoutsRemaining = gameSetting.timeouts;
    gameInfo.player2.appealsRemaining = gameSetting.appeals;
    gameInfo.player2.technicals = 0;

    updateGame(req.params.id, gameInfo);

    res.json(gameInfo);
  });

  router.post('/api/game/:id/point', (req, res) => {
    const gameInfo = getGame(req.params.id);

    const pointInfo = req.body;

    gameInfo[pointInfo.server][`score${gameInfo.game}`] += pointInfo.points;
    const gameSetting = gameConfig[gameInfo.config || "usar"][gameInfo.game - 1];

    const minPoints = 0;
    const maxPoints = gameSetting.maxScore;

    if (gameInfo[pointInfo.server][`score${gameInfo.game}`] < 0) gameInfo[pointInfo.server][`score${gameInfo.game}`] = 0;

    if (gameInfo[pointInfo.server][`score${gameInfo.game}`] > maxPoints) gameInfo[pointInfo.server][`score${gameInfo.game}`] = maxPoints;

    const newGameInfo = updateGame(req.params.id, gameInfo); 
    console.log("POST", req.body)
    res.json(newGameInfo);
  });

app.use('/scoreboard', router);
app.use('/scoreboard/public', express.static('public'));
restoreGameState();
app.listen(3000,function() {
    console.log("Server started");
});