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
    ],
    manilla: [
        defaultTieBreakerGameConfig,
        defaultTieBreakerGameConfig,
        defaultTieBreakerGameConfig,
        defaultTieBreakerGameConfig,
        defaultTieBreakerGameConfig
    ]
};

const blankGame = {
    id: 0,
    logo: "cvra",
    division: "",
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
        timeoutsRemaining: 0,
        appealsRemaining: 0,
        technicals: 0,
        score1: 0,
        score2: 0,
        score3: 0,
        score4: 0,
        score5: 0
    },
    eventId: 0,
    config: defaultGameType,
    server: "player1",
    game: 1
};

let state = {
    events: {},
    games: {}
};

const gameStateFile = './gameinfo/state.json';

const gameSaver = setInterval(() => {
    const data = JSON.stringify(state);
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
        state = JSON.parse(data);
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
    console.log(newGameInfo);
    return newGameInfo;
}

function getEventGames(eventId) {
    const games = [];

    for (const key in state.games) {
        if (Object.hasOwnProperty.call(state.games, key)) {
            const g = state.games[key];
            if (g.eventId === eventId) {
                games.push(g);
            }
        }
    }

    return games;
}


router.get('/api/events', (req, res) => {
    const eventsList = state.events;
    res.json(eventsList);
});

router.post('/api/event/:eventId', (req, res) => {
    const newEvent = {
        name: req.body.name,
        config: req.body.config,
        logo: req.body.logo,
        eventId: +req.params.eventId,
    };

    if (!fs.existsSync(`public/logos/${newEvent.logo}.png`)) {
        console.log(`Invalid logo defined: ${newEVent.logo}`);
        newEvent.logo = "cvra";
    }

    if (!gameConfig[newEvent.config]) {
        console.log(`Invalid game config defined: ${newEVent.config}`);
        newEvent.config = "usar";
    }

    console.log(`POST /api/event/${req.params.eventId}`, req.body)

    if (!newEvent.name || isNaN(newEvent.eventId)) {
        res.status(400).send('Bad Event Info!');
        return;
    }

    state.events[newEvent.eventId] = newEvent;
    console.log(`POST /api/event/${req.params.eventId}`, req.body)

    res.json(newEvent);
});

router.get('/', (req, res) => {
    const eventsCopy = JSON.parse(JSON.stringify(state.events));
    const eventsList = [];
    for (const key in eventsCopy) {
        if (Object.hasOwnProperty.call(eventsCopy, key)) {
            const event = eventsCopy[key];
            const eventGames = getEventGames(event.eventId);
            event.gameCount = eventGames.length;
            eventsList.push(event);
        }
    }

    const vm = {events: eventsList};
    res.render('index', vm);
});

router.get('/event/:eventId', (req, res) => {
    const event = state.events[req.params.eventId];
    const games = getEventGames(event.eventId);

    const eventBundle = {
        event,
        games
    };

    res.render('event', eventBundle);
});

router.get('/newMatch/:eventId', (req, res) => {
    const newId = uuidv4();
    const gameInfo = getGame(newId);
    gameInfo.eventId = +req.params.eventId;
    const event = state.events[gameInfo.eventId];
    gameInfo.config = event.config || defaultGameType;
    gameInfo.logo = event.logo || gameInfo.logo;
    updateGame(newId, gameInfo);
    res.redirect(`/scoreboard/game/${newId}`);
});

function enrichGameInfo(gameInfo) {
    if (gameInfo.logo === "manilla") {
        gameInfo.borderColor = "goldenrod";
        gameInfo.backgroundColor = "gold";
    } else {
        gameInfo.borderColor = "darkblue";
        gameInfo.backgroundColor = "lightblue";
    }
}

router.get('/game/:id', (req, res) => {
    const gameInfo = getGame(req.params.id);
    enrichGameInfo(gameInfo);
    res.render('scoreboard', gameInfo);
});

router.get('/cast/:id', (req, res) => {
    const gameInfo = getGame(req.params.id);
    enrichGameInfo(gameInfo);
    res.render('castScoreboard', gameInfo);
});

router.get('/api/game/:id', (req, res) => {
  const gameInfo = getGame(req.params.id);
  enrichGameInfo(gameInfo);
  res.json(gameInfo);
});

router.post('/api/game/:id', (req, res) => {
    const newGameInfo = updateGame(req.params.id, req.body); 
    console.log("POST", req.body)
    res.json(newGameInfo);
});

router.post('/api/game/:id/game', (req, res) => {
    const gameInfo = getGame(req.params.id);

    if (gameInfo.game >= gameConfig[gameInfo.config || "usar"].length) {
        res.json(gameInfo);
        return;
    }

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

    if (gameInfo[pointInfo.server][`score${gameInfo.game}`] < -5) gameInfo[pointInfo.server][`score${gameInfo.game}`] = 0;

    if (gameInfo[pointInfo.server][`score${gameInfo.game}`] > maxPoints) gameInfo[pointInfo.server][`score${gameInfo.game}`] = maxPoints;

    const newGameInfo = updateGame(req.params.id, gameInfo); 
    console.log("POST", req.body)
    res.json(newGameInfo);
});

router.get('/health', (req, res) => {
    res.send('healthy');
});

app.use('/scoreboard', router);
app.use('/scoreboard/public', express.static('public'));
restoreGameState();
app.listen(3000,function() {
    console.log("Server started");
});