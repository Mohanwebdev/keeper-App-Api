//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require("cors");
const session =  require("express-session");
const MemoryStore = require('memorystore')(session)
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

// const MongoStore = require('connect-mongo')(session);
const { json } = require('body-parser');


const app = express();

app.set('trust proxy', 1);
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
  });

app.use(session({
    secret:process.env.SECRET_KEY,
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    resave: false,
    // cookie:{
    // secure: true,
    // maxAge:60000
    //    },
// store: new RedisStore(),
// secret: 'secret',
// saveUninitialized: true,
// resave: false
    resave: false,
    saveUninitialized: true,
    // cookie: {}
  }));
app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery', true);

mongoose.connect("mongodb+srv://"+process.env.DB_USERNAME+":"+process.env.DB_PASSWORD+"@cluster0.bn8mc.mongodb.net/NotesApp?retryWrites=true&w=majority", { useNewUrlParser: true });

const Schema = mongoose.Schema;


const userSchema = new Schema({
 username:String

});


const dataSchema = new Schema({
  username:String,
  notes:[Object]
})
userSchema.plugin(passportLocalMongoose);


const User = mongoose.model('User', userSchema);
const Data = mongoose.model('Data', dataSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.post("/addNote",async (req,res)=>{
    const note = {noteId:req.body.noteId,
        title:req.body.title,
        content:req.body.content};
        
    const notesFound = await Data.findOneAndUpdate(
        { username: req.body.username}, 
         {$push: {notes: note} } ,{
            new: true
          }
    );
    if(notesFound){
        res.json({notes:notesFound.notes})
    }


});

app.post("/editNote",async(req,res)=>{
    await Data.findOneAndUpdate(
        {"username": req.body.username,"notes": { "$elemMatch": { "noteId": req.body.noteId }}},
        {"$set": { "notes.$.title":req.body.title,"notes.$.content":req.body.content}}

    );
    
    const notesFound = await Data.findOne(
        { username: req.body.username});
    if(notesFound){
        res.json({notes:notesFound.notes})
    }

})


app.post("/deleteNote",async(req,res)=>{
await Data.findOneAndUpdate({ username:req.body.username}, { $pull: { notes: { noteId: req.body.id } }}, { safe: true, multi:true } );
const notesFound = await Data.findOne(
    { username: req.body.username});
if(notesFound){
    res.json({notes:notesFound.notes})
}
});

app.post("/register", async (req, res) => {
    const result = await User.findOne({username:req.body.username});
    if(!result){
        try{
            User.register({username:req.body.username},req.body.password,function(err,user){
                if(err){
                  
                }else{

                    passport.authenticate("local")(req,res,async()=>{
                        const data = new Data({username:req.body.username,notes:[]});
                        const foundResult = await data.save();
                        res.json({exist:false,
                            status:true,
                            newUser:true,
                        notes:foundResult.notes});
                        
                    });
                }
            });
          }
          catch(err){
            console.log("err");
          }
        
    }
    else{
        res.json({exist:true,
        status:false});
    }
 


});




app.post("/login", passport.authenticate("local"), async(req, res)=>{
    if(req.isAuthenticated()){
        const notesFound = await Data.findOne(
            { username: req.body.username} );
        if(notesFound){
            res.json({status:true,
                notes:notesFound.notes})
        }
    }
    else{res.json({status:false,
    err:true});}
});


app.get("/logout",(req,res)=>{
    req.logOut((err)=>{
        if(!err){
            res.json({status:false })
        }
    });
  
    
})





app.listen(process.env.PORT || 5000, function () {
    console.log("server started at port 5000");
})
