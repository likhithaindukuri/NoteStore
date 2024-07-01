const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const { ensureAuthenticated } = require('./auth');
require('./passport')(passport);
const memberRoutes = require('./routes/memberroutes');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const morgan = require('morgan');
const flash = require('connect-flash');
const fs = require('fs');
const multer = require('multer');
const upload = multer(); 

// Express App
const app = express();
const port = process.env.PORT || 3000;

// Data Base
const password_db = require('./models/model.password');
const notes_db = require('./models/model.notes');

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
  .then(() => app.listen(port))
  .catch(err => console.log(err));

// View Engine
app.set('view engine', 'ejs');

// Static , Password , Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('dev'));
app.use(
  session({
    secret: 'likhitha',
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
  req.logout(function(err) {
    if (err) {
      console.error('Error logging out:', err);
      return next(err);
    }
    req.flash('success_msg', 'You are logged out'); 
    res.redirect('/login'); 
  });
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
    document_data: file.buffer, 
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
            res.json({ redirect: '/' });
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

// Serve PDF files from the database
app.get('/uploads/:docname', ensureAuthenticated, (req, res) => {
  const docName = req.params.docname;

  notes_db.findOne({ _id: docName, contributer_id: req.session.passport.user }, (err, note) => {
      if (err) {
          console.error('Error finding note:', err);
          return res.status(500).send('Error finding note.');
      }

      if (!note) {
          return res.status(404).send('Note not found.');
      }

      res.contentType("application/pdf");
      res.send(note.document_data);
  });
});


// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});
