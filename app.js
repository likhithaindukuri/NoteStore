const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const { ensureAuthenticated } = require('./auth');
require('./passport')(passport);
const memberRoutes = require('./routes/memberroutes');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const morgan = require('morgan');
const flash = require('connect-flash');
// const mailgun = require('mailgun-js');
// console.log(process.env);

//Express App
const app = express();
const port = process.env.PORT || 3000;

//Data Base
const password_db = require('./models/model.password');
const notes_db = require('./models/model.notes');
const dburl = process.env.DB_URL;
mongoose
  .connect(process.env.DB_UR, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
  .then(() => app.listen(port))
  .catch(err => console.log(err));

//View Engine
app.set('view engine', 'ejs');

//Multer
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Storing files directly in the 'uploads' directory

//Static , Password , Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('dev'));
app.use(
  session({
    secret: 'gowtham',
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Authentication
app.get('/login', (req, res) => {
  const error = req.flash().error || [];
  res.render('login', { error });
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: 'dashboard',
    failureRedirect: 'login',
    failureFlash: 'Invalid Username or password',
  })(req, res, next);
});

app.get('/register', (req, res) => {
  res.render('register', { error: '' });
});

app.post('/register', (req, res) => {
  if (req.body.password1 != req.body.password2) {
    res.render('register', { error: 'Password did not match' });
  } else {
    const newuser = new password_db({ name: req.body.name, email: req.body.mail, password: req.body.password1 });
    bcrypt.genSalt(10, (err, salt) =>
      bcrypt.hash(newuser.password, salt, (err, hash) => {
        if (err) throw err;
        newuser.password = hash;
        newuser
          .save()
          .then(user => {
            res.redirect('/login');
          })
          .catch(err => {
            res.render('register', { error: 'Username Already Exists' });
          });
      })
    );
  }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Adding Notes
app.post("/newnotes", ensureAuthenticated, upload.single('doc'), (req, res) => {
  const file = req.file;
  if (!file) {
      return res.status(400).send('No file uploaded.');
  }

  const newNote = new notes_db({
      title: req.body.title,
      type: req.body.type,
      domain: req.body.domain,
      contributer_id: req.session.passport.user,
      // Set document_id to null since we're not using Google Drive API
      document_id: null,
      document_url: '/uploads/' + file.filename, // Construct the URL to access the file
  });

  newNote.save()
      .then(note => {
          res.redirect('/');
      })
      .catch(err => {
          console.error('Error saving note:', err);
          res.status(500).send('Error saving note.');
      });
});
// Delete Note Route
app.delete('/:id', ensureAuthenticated, (req, res) => {
  const user_id = req.session.passport.user;
  const notes_id = req.params.id;

  notes_db.findById(notes_id)
    .then(result => {
      if (result.contributer_id == user_id) {
        // Delete note from the database
        notes_db.findByIdAndDelete(notes_id)
          .then(() => {
            // Delete the corresponding file from the server
            const filePath = `public${result.document_url}`;
            fs.unlink(filePath, (err) => {
              if (err) {
                console.error('Error deleting file:', err);
                res.status(500).json({ error: 'Error deleting file.' });
              } else {
                res.json({ redirect: '/' });
              }
            });
          })
          .catch(err => {
            console.error('Error deleting note:', err);
            res.status(500).json({ error: 'Error deleting note.' });
          });
      } else {
        res.status(403).json({ error: 'Unauthorized' });
      }
    })
    .catch(err => {
      console.error('Error finding note:', err);
      res.status(500).json({ error: 'Error finding note.' });
    });
});


// Member Notes
app.use('/', memberRoutes);
// Serve PDF files
app.get('/uploads/:docname', (req, res) => {
  var file_name = req.params.docname;
  var render_file = "/uploads/" + (file_name);

  fs.readFile(__dirname + render_file, function (err, data) {
    if (err) {
      console.error('Error reading file:', err);
      res.status(500).send('Error reading file.');
    } else {
      res.contentType("application/pdf");
      res.send(data);
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});
