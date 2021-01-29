const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));
/* Log info of every request made */
app.use((req, res, next) => {
  console.log(req.method, req.ip, req.path);
  next();
});

// MongoDB database
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
  console.log("Connected to database");

  const userExSchema = new mongoose.Schema({
  	username: String,
  	count: Number,
  	log: [{
  		description: String,
  		duration: Number,
  		date: { type: Date, default: Date.now },
  		_id: false   // So each object object in the log does not have an _id path
  	}]
  });

  // Model
  const ExerciseTracker = mongoose.model('ExerciseTracker', userExSchema);

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
  });

  /* User tries to register a new user. Adds a user if the user is not previously in the 
  database. Returns the json of the username and _id in any case. */
  app.post('/api/exercise/new-user', (req, res) => {
  	ExerciseTracker.findOne({username: req.body.username}, (err, user) => {
  		if (err) {
  			console.error(err);
  			res.send(err);
  		}
  		else if (!user) {
        // The user is not in the database
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
            // Send the json of the user with its username and _id after saving
  					res.json({
  						username: doc.username,
  						_id: doc._id
  					});
  				}
  			});
  		} else {
        // The user is in the database. Send the json of username and _id
  			res.json({
  				username: user.username,
  				_id: user._id
  			});
  		}
  	});
  });

  /* Add an exercise entry to a user using the user's _id as the key to search 
  (But normally since the way username is implemented, it's unique it would have 
  been more intuitive that the key is the username rather than the long _id string
  which one wouldn't like to cram anyway. But it is what it is. I do what Freecodecamp
  says and move on ;-) ) */
  app.post('/api/exercise/add', (req, res) => {
  	ExerciseTracker.findById(req.body.userId, (err, user) => {
  	  if (err) {
  	  	err.name === "CastError" ? res.send("The ID supplied is incorrect") :
  	  							               res.send("An error occured " + err.name);
  		  console.error(err.name);
  	  } else if (!user) {
  		  res.send("No such user with the specified id found: " + req.body.userId);
  		} else {
  			  const date = new Date(req.body.date) == "Invalid Date" ? new Date() :
  																	                       new Date(req.body.date);
  		    let newExercise = {
  			    description: req.body.description || "No description specified",
  			    duration: req.body.duration || "No duration specified",
  			    date: date
  			  }
  			  
          user.log.push(newExercise);
  			  user.count++;
  			  
          user.save((err, doc) => {
  			    if (err) {
  			 	    console.error(err);
  				    res.send("An error occured " + err.name);
  			  } else {
              // The last log that was just saved should be sent as response
              // with the username and id of the user
  			  	  const justSaved = doc.log[doc.log.length-1];
  				    res.json({
  					    username: doc.username,
  					    _id: doc._id,
  					    date: justSaved.date.toDateString(),
  					    duration: justSaved.duration,
  					    description: justSaved.description
  				    });
  			  }
  		  });
  		}
  	});
  });

  /* Respond with all the users in the database showing 
  only their usernames and _id */
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

  /* Get the log of all the exercise entries added for a user using the _id 
  as the key. Users can specify parts of the log to return such as logs 
  within a date duration and also the number of log entries to be returned */
  app.get('/api/exercise/log', (req, res) => {
  	const id = req.query.userId;
  	
    // Default query in case the user does not specify or specified an
    // invalid query.
    const Default = {
      gte: new Date(-8640000000000000),   // from the earliest date
      lte: new Date(8640000000000000),    // to the latest date
      limit: 1000                         // An Arbitrary number that hopefully the 
                            // entry is not up to (Wanted to use Number.MAX_SAFE_INTEGER)
                            // but mongodb rejected it. This number can be changed anytime
    }

    /* Date interval and number of log to return */
  	let gte = new Date(req.query.from) == "Invalid Date" ? Default.gte :
  															                           new Date(req.query.from);
  	let lte = new Date(req.query.to) == "Invalid Date" ? Default.lte :
  															                         new Date(req.query.to);
  	let limit = isNaN(req.query.limit) ? Default.limit : +req.query.limit;

    /* $match -> matches the only document that has an id specified in the object
       $project -> only returns path specified (username, count, log) with log
       having $slice -> to limit the number of elements in the log array and 
       $filter -> to only return elements in the array that passes required conditions
       $gte -> dates greater than/equal to $and $lte -> dates less than/equal to */
  	const result = ExerciseTracker.aggregate([
      // Pardon extra spaces - It was for easy readability but I don't know if I
      // overdid it
      { $match: { _id: mongoose.Types.ObjectId(id) }},
      { $project: { username: 1, count: 1, 
                    log: { $slice: [{ $filter: { input: '$log', as: 'item', 
                                                 cond: { $and: [ {$gte: ['$$item.date', gte]}, 
                            			                               {$lte: ['$$item.date', lte]} 
                                                               ]
                            	                         }
                                               } 
                                    }, limit]}
                  }
      }
    ]).exec((err, data) => {
      if (err) {
        console.error(err);
        res.json("An error occured " + err.name)
      }

      data = data[0];   // An array is returned where required data is the only data
      data.count = data.log.length; // After slicing/limiting, the count that should
                                    // be sent should be what number of log entries
      data.query = {};              // Just to show the user the queries used
      
      /* If it is not the default value that was used, the user should see the 
      queries passed to generate the response */
      if (gte !== Default.gte) {
        data.query.from = gte.toDateString(); 
      }
      if (lte !== Default.lte) {
        data.query.to = lte.toDateString();
      }
      if (limit !== Default.limit) {
        data.query.limit = limit;
      }

      /* Change the date so it shows a better formmated date string */
      for (let elem in data.log) {
      	data.log[elem].date = data.log[elem].date.toDateString();
      }
      
      res.json(data);
    });;
  });
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
