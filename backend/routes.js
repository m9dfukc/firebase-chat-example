const express  = require('express'),
      handler  = require('express-async-handler'),
      firebase = require('firebase-admin'),
      crypto   = require('crypto'),
      uuidv1   = require('uuid/v1'),
      config   = require('./config.js'),
      router   = express.Router();

firebase.initializeApp({
  credential: firebase.credential.cert(config.databaseCredentials),
  databaseURL: config.databaseURL
});

const db = firebase.database();

router
  .post('/user', handler( async (req, res) => {
    const {username, number, location} = req.body;
    const hash = crypto.createHash('md5').update(number).digest('hex');
    const token = await firebase.auth().createCustomToken(hash);
    const uuid = uuidv1();
    const created = Date.now();
    const data = {
      uuid,
      username,
      number,
      location,
      hash,
      token,
      created,
      modified: created
    };
    db.ref('users').child(username).set(data);
    res.json(data);
  }))
  .get('/user/:id', handler( async (req, res) => {
    const value = await db.ref(`/users/${req.params.id}`).once('value');
    res.json(value.val() || {});
  }))
  .delete('/user/:id', handler( async (req, res) => {
    await db.ref(`/users/${req.params.id}`).remove();
    res.send(201);
  }))
  .get('/users', handler( async (req, res) => {
    const value = await db.ref('/users').once('value');
    res.json(value.val() || {});
  }))
;

router
  .post('/drive', handler( async (req, res) => {
    const {username} = req.body;
    const created = Date.now();
    let data = {
      username,
      created,
      modified: created,
      active: true
    };
    const snapshot = await db.ref('drives').push(data);
    await db.ref('users').child(`${username}/drives`).push({
      id: snapshot.key
    });
    data['id'] = snapshot.key;
    res.json(data || {});
  }))
  .put('/drive/:id/cancel', handler( async (req, res) => {
    const id = req.params.id;
    const modified = Date.now();
    await db.ref(`/drives/${id}`).update({
      modified,
      active: false
    });
    const value = await db.ref(`/drives/${id}`).once('value');
    res.json(value.val() || {});
  }))
  .get('/drive/:id', handler( async (req, res) => {
    const value = await db.ref(`/drives/${req.params.id}`).once('value');
    res.json(value.val() || {});
  }))
  .get('/drives', handler( async (req, res) => {
    const value = await db.ref(`/drives`).once('value');
    res.json(value.val() || {});
  }))
  .get('/drives/:username', handler( async (req, res) => {
    const ref = db.ref(`/drives`).orderByChild('username').equalTo(req.params.username);
    const value = await ref.once('value');
    res.json(value.val() || {});
  }))
;


module.exports = router;
