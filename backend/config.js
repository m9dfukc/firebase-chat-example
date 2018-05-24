const databaseCredentials = require('./firebase.json');
const config = {
  databaseURL: 'https://chat-example-pampa.firebaseio.com',
  projectId: databaseCredentials.project_id,
  databaseCredentials
};

module.exports = config;
