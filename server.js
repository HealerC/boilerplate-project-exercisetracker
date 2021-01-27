const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

app.use(cors());
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

app.use(bodyParser.urlencoded({extended: false}));
db.once('open', function() {
  console.log("Connected to database");

  const userExSchema = new mongoose.Schema({
  	username: String,
  	exerciseList: [{
  		description: String,
  		duration: Number,
  		date: { type: Date, default: Date.now } 
  	}]
  });

  const ExerciseTracker = mongoose.model('ExerciseTracker', userExSchema);


  app.post('/api/exercise/new-user', (req, res) => {
  	ExerciseTracker.findOne({username: req.body.username}, (err, user) => {
  		if (err) {
  			console.error(err);
  			res.send(err);
  		}
  		else if (!user) {
  			const newUser = new ExerciseTracker({
  				username: req.body.username,
  				exerciseList: []
  			});

  			newUser.save((err, doc) => {
  				if (err) {
  					console.error(err);
  					res.send(err);
  				} else {
  					res.json({
  						username: doc.username,
  						id: doc._id
  					});
  				}
  			});
  		} else {
  			res.json({
  				username: user.username,
  				id: user._id
  			});
  		}
  	});
  });

  app.post('/api/exercise/add', (req, res) => {
  	ExerciseTracker.findById(req.body.userId, (err, user) => {
  	  if (err) {
  		console.error(err);
  		res.send(err);
  	  } else if (!user) {
  		  res.send("No such user with the specified id found:", req.body.userId);
  		} else {
  		    let newExercise = {
  			  description: req.body.description || "No description specified",
  			  duration: req.body.duration || "No duration specified",
  			  date: new Date(req.body.date) || new Date()
  			}
  			user.exerciseList.push(newExercise);
  			user.save((err, doc) => {
  			  if (err) {
  			 	console.error(err);
  				res.send(err);
  			  } else {
  				  res.json({
  					username: doc.username,
  					id: doc._id,
  					date: newExercise.date.toDateString(),
  					duration: newExercise.duration,
  					description: newExercise.description
  				});
  			  }
  		  })
  		}
  	})
  });

  
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
