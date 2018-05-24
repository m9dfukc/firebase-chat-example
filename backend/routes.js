const express  = require('express'),
      handler  = require('express-async-handler'),
      firebase = require('firebase-admin'),
      crypto   = require('crypto'),
      uuidv1   = require('uuid/v1'),
      config   = require('./config.js'),
      router   = express.Router();

firebase.initializeApp({
  credential: firebase.credential.cert(config.databaseCredentials),
  databaseURL: config.databaseURL,
  projectId: config.projectId
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
    await db.ref('/users').child(username).set(data);
    res.json(data);
  }))
  .put('/user/:id/device', handler( async (req, res) => {
    const {token} = req.body;
    const {id} = req.params;
    const data = {
      deviceToken: token,
      modified: Date.now()
    };
    await db.ref('/users').child(id).update(data);
    const value = await db.ref('/users').child(id).once('value');
    res.json(value.val() || {});
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
    const {username, from, to} = req.body;
    const created = Date.now();
    let data = {
      username,
      from,
      to,
      created,
      modified: created,
      active: true
    };
    const snapshot = await db.ref('/drives').push(data);
    await db.ref('users').child(`${username}/drives/${snapshot.key}`).set(true);
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

router
  .post('/chat/:driveId', handler( async (req, res) => {
    const {driveId} = req.params;
    const ref = await db.ref(`/drives/${driveId}`).once('value');
    const drive = ref.val();
    const sender = req.body.username;
    const receiver = drive.username;
    const title = `${drive.from} - ${drive.to}`;
    const created = Date.now();
    let data = {
      title,
      driveId,
      created,
      participants: [sender, receiver],
      modified: created
    };
    const snapshot = await db.ref('/chats').push(data);
    await db.ref('users').child(`${sender}/chats/${snapshot.key}`).set(true);
    await db.ref('users').child(`${receiver}/chats/${snapshot.key}`).set(true);
    await db.ref('drives').child(`${driveId}/chats/${snapshot.key}`).set(true);
    data['id'] = snapshot.key;
    res.json(data || {});
  }))
  .post('/chat/:chatId/message', handler( async (req, res) => {
    const {username, message} = req.body;
    const {chatId} = req.params;
    const created = Date.now();
    let sender, receiver = undefined;
    let data = {
      username,
      message,
      created,
      modified: created
    };
    const charRef = await db.ref(`/chats/${chatId}`).once('value');
    const chat = chatRef.val();
    for (participant in chat.participants) {
      if (username === participant) sender = participant;
      else receiver = participant;
    }
    const snapshot = await db.ref('/chats').child(`${chatId}/messages`).push(data);
    await db.ref('users').child(`${sender}/chats/${snapshot.key}`).set(true);
    await db.ref('users').child(`${receiver}/chats/${snapshot.key}`).set(true);

    const receiverRecordRef = await db.ref('users').child(receiver).once('value');
    const receiverRecord = receiverRecordRef.val();
    const pushMessage = {
      token: receiver.deviceToken,
      data: {
        chatId: chatId,
        messageId: snapshot.key,
        type: 'chat'
      },
      notification: {
        title: chat.title,
        body: message,
        sound: true
      },
      android: {
        ttl: 3600 * 1000, // 1 hour in milliseconds
        priority: 'hight',
        notification: {
          title: chat.title,
          body: message,
          icon: 'stock_ticker_update',
          color: '#f45342'
        }
      },
      apns: {
        header: {
         'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: chat.title,
              body: message,
            },
            badge: 42,
          }
        }
      }
    };
    await admin.messaging().send(pushMessage);

    data['id'] = snapshot.key;
    res.json(data || {});
  }))
  .get('/chat/:chatId', handler( async (req, res) => {
    const ref = db.ref(`/chats`).child(req.params.chatId);
    const value = await ref.once('value');
    res.json(value.val() || {});
  }))
  .get('/chat/:chatId/message/:messageId', handler( async (req, res) => {
    const {chatId, messageId} = req.params;
    const ref = db.ref(`/chats`).child(`${chatId}/messages/${messageId}`);
    const value = await ref.once('value');
    res.json(value.val() || {});
  }))
;


module.exports = router;
