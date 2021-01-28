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
  	count: Number,
  	log: [{
  		description: String,
  		duration: Number,
  		date: { type: Date, default: Date.now },
  		_id: false
  	}]
  });

  //userExSchema.methods.render = function() {}
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
  				count: 0,
  				log: []
  			});

  			newUser.save((err, doc) => {
  				if (err) {
  					console.error(err);
  					res.send(err);
  				} else {
  					res.json({
  						username: doc.username,
  						_id: doc._id
  					});
  				}
  			});
  		} else {
  			res.json({
  				username: user.username,
  				_id: user._id
  			});
  		}
  	});
  });

  app.post('/api/exercise/add', (req, res) => {
  	ExerciseTracker.findById(req.body.userId, (err, user) => {
  	  if (err) {
  	  	err.name === "CastError" ? res.send("The ID supplied is incorrect") :
  	  							   res.send("An error occured " + err.name);
  		console.error(err.name);
  	  } else if (!user) {
  		  res.send("No such user with the specified id found: " + req.body.userId);
  		} else {
  		    let newExercise = {
  			  description: req.body.description || "No description specified",
  			  duration: req.body.duration || "No duration specified",
  			  date: new Date(req.body.date) || new Date()
  			}
  			user.log.push(newExercise);
  			user.count++;
  			user.save((err, doc) => {
  			  if (err) {
  			 	console.error(err);
  				res.send(err);
  			  } else {
  			  	  const justSaved = doc.log[doc.log.length-1];
  				  res.json({
  					username: doc.username,
  					_id: doc._id,
  					date: justSaved.date.toDateString(),
  					duration: justSaved.duration,
  					description: justSaved.description
  				});
  			  }
  		  })
  		}
  	})
  });

  app.get('/api/exercise/users', (req, res) => {
  	ExerciseTracker.find({}).select({username: 1, _id: 1})
  				   .exec((err, docs) => {
  				     if (err) {
  				       console.error(err.name);
  				       res.send("An error occured: " + err.name);
  				     } else {
  				       res.json(docs);
  				     }
  				   });
  });

  app.get('/api/exercise/log', (req, res) => {
  	const id = req.query.userId;
  	ExerciseTracker.findById(id, (err, user) => {
  	  if (err) {
  	  	err.name === "CastError" ? res.send("The ID supplied is incorrect") :
  	  							   res.send("An error occured " + err.name);
  		console.error(err.name);
  	  } else if (!user) {
  	  	res.send("No such user with the specified id found: " + id);
  	  } else {
  	  	const copy = user.toObject();

  	  	copy.log = copy.log.map(data => {
  	  	  return {
  	  	  	description: data.description,
  	  	  	duration: data.duration,
  	  	  	date: data.date.toDateString()
  	  	  };
  	  	});
  	  	
  	  	delete copy.__v;
  	  	
  	  	res.json(copy);
  	  }
  	})
  });
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
