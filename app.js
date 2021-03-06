//App configuration
var express = require('express');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var session = require('express-session');
var bcrypt = require('bcrypt');
var app = express();
var methodOverride = require('method-override');

app.use(methodOverride('_method'));
app.set("view engine","ejs");
app.use(express.static('public')); //specify folder for images,css,js
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: 'top secret code!',
    resave: true,
    saveUninitialized: true
}));

var connection = mysql.createPool({
  host: "us-cdbr-east-02.cleardb.com",
  user: "b106186f8dedb8",
  password: "24a96bfd",
  database: "heroku_8b16e6334be95e8"
});

module.exports = connection;

//DATABASE INFO
/*
username:b106186f8dedb8
password:24a96bfd
host:us-cdbr-east-02.cleardb.com
database:heroku_8b16e6334be95e8
*/
//TO IMPORT SQL FILE DO THIS ONLY IF YOU DROP THE DATABASE AND RECREATE IT (BE CAREFUL WITH THIS)
//mysql --host=us-cdbr-east-02.cleardb.com --user=b106186f8dedb8 --password=24a96bfd --reconnect heroku_8b16e6334be95e8 < sql/video-game-db.sql

//TO USE THE DATABASE DO THIS IN THE TERMINAL
//mysql --host=us-cdbr-east-02.cleardb.com --user=b106186f8dedb8 --password=24a96bfd --reconnect heroku_8b16e6334be95e8

//THIS IS THE NAME OF OUR TABLE WHERE USERS AND VIDEO GAMES ARE IN
//heroku_8b16e6334be95e8

/*
INSERT INTO `users` (`userId`,`firstname`,`lastname`,`username`,`password`) VALUES
(1,'Cristian','Arredondo','CristianArredondo123','123'),
(2,'Christian','Jimenez','ChristianJimenez123','1234'),
(3,'Victor','Cuin','VictorCuin123','12345'),
(4,'Elijah','Hallera','ElijahHallera123','123456');
*/

//INITIAL ROUTES
//-------------------------------------------------------------------------------------
app.get("/homeSignedIn", async function(req,res){
    res.render("homeSignedIn"); //sends array of parsedData to the home.ejs view
});

//AUTHENTICATION FOR HOME
app.get('/home', isAuthenticatedHome, function(req, res){
   res.redirect('/');
});

//DEFAULT HOME
app.get('/', isAuthenticatedHome, function(req, res){
   res.render('homeSignedIn', {user: req.session.user}); 
});

app.get('/login', function(req, res){
    res.render('login');
});


app.get('/logout', function(req, res){
   req.session.destroy();
   res.redirect('/');
});

app.get('/create_account', function(req,res){
    res.render('create_account');
});


app.get('/edit', async function(req,res){
    res.render('edit', {user: req.session.user, username: req.session.firstname, last: req.session.lastname, password: req.session.password, userId: req.session.userId});
});

app.get('/user', function(req, res){
    var username = req.session.user;
    
    var statement = 'select firstname,lastname,userMoney ' +
               'from users ' +
               'where users.username=\'' 
                + username + '\';';
                
    connection.query(statement,function(error, results){
        
        if(error) throw error;
        
        var userMoney = results[0].userMoney;
        
        res.render('user', {user: req.session.user, firstname:req.session.firstname, lastname:req.session.lastname, password: req.session.password, userId: req.session.userId,userMoney:userMoney});
        
    });
});

app.put('/users/:userId', function(req, res){
    
    var stmt = 'UPDATE users SET ' +
                'firstname = "' +
                req.body.firstname +
                '",' +
                'lastname = "' +
                req.body.lastname +
                '",' +
                'username = "' +
                req.body.username +
                '"' +
                'WHERE userId = ' +
                req.session.userId +
                ';';
    connection.query(stmt, function(error, result){
        if(error){
          console.log("didnt work");
          throw error;  
        } 
        console.log(result);
        req.session.destroy();
        res.redirect('/login');
    });
});

//INSERTS THE NEW ACCOUNT INTO THE USERS TABLE BY TAKING INFO FROM CREATE ACCOUNT EJS
app.post('/create_account', function(req, res){
    let salt = 10;
    bcrypt.hash(req.body.password, salt, function(error, hash){
        if(error) throw error;
        let stmt = 'INSERT INTO users (firstname,lastname,username,password) VALUES (?,?,?,?)';
        let data = [req.body.firstname,req.body.lastname,req.body.username,hash];
        connection.query(stmt, data, function(error, result){
           if(error) throw error;
           console.log(stmt);
           res.redirect('/login');
        });
    });
});

//CHECKS IF USERNAME AND PASSWORD ARE IN THE DATABASE USER TABLE
app.post('/login', async function(req, res){
    let isUserExist = await checkUsername(req.body.username);
    let hashedPasswd = isUserExist.length > 0 ? isUserExist[0].password : '';
    let passwordMatch = await checkPassword(req.body.password, hashedPasswd);
    if(passwordMatch){
        req.session.authenticated = true;
        req.session.user = isUserExist[0].username;
        req.session.firstname = isUserExist[0].firstname;
        req.session.lastname = isUserExist[0].lastname;
        req.session.password = req.body.password;
        req.session.userId = isUserExist[0].userId;
        
        //CHECK BACK HERE
        res.redirect('/');
    }
    else{
        res.render('login', {error: true});
    }
});

app.get('/productDetail', function(req, res){
    var sql = 'select * from games where name="'  + req.query.title + '" and quantity>0 and userId IS NULL;';
	connection.query(sql, function(error, found){
	    var title = null;
	    if(error) throw error;
	    if(found.length){
	        title = found[0];
	    }
	    res.render('productDetail', {title: title});
	});
});

//ROUTE TO SHOW USERS CART
app.get('/myGames', isAuthenticatedHome, function(req,res){
    
    var username = req.session.user;
    var statement = 'select userId ' +
               'from users ' +
               'where users.username=\'' 
                + username + '\';';
    
    connection.query(statement,function(error, results){
        
        if(error) throw error;
        
        var usersId = results[0].userId;
               
        var stmt = 'select * ' +
               'from games ' +
               'where games.userId=' 
                + usersId + ' and games.purchased=true;'; //,games.purchased=false;
               
    connection.query(stmt, function(error, results){
        
        if(error) throw error;
        
        res.render('myGames', {gamesInfo:results});  //both name and quotes are passed to quotes view     
    });
});
});

//NEW ADD CART
app.get('/cart/:aid/add', function(req,res){
    
    var username = req.session.user;
    
    var statement = 'select userId ' +
               'from users ' +
               'where users.username=\'' 
                + username + '\';';
    
    connection.query(statement,function(error, results){
        
        if(error) throw error;
        
        var usersId = results[0].userId;
        
        connection.query('SELECT COUNT(*) FROM games', function(error,results){
        
        if(error) throw error;
        
        if(results.length){
            
            console.log(results);
            
            //RETRIEVING RECIPE
             var statement = 'select * ' +
               'from games ' +
               'where games.gameId=\'' 
                + req.params.aid + '\';';
        
            connection.query(statement,function(error,results){
                
                var games = results[0];
                
                var stmt = 'INSERT INTO games ' + 
                '(`userId`, `name`,`image`,`yearMade`,`genre`,`summary`,`gamePrice`,`quantity`) ' +
                'VALUES ' +
                '(' +
                usersId + ',"' +
                games.name + '","' +
                games.image + '",' +
                games.yearMade + ',"' +
                games.genre + '","' +
                games.summary + '",' +
                games.gamePrice + ',' +
                games.quantity + '' +
                ');';
                
                console.log(stmt);
                
                connection.query(stmt, function(error, result) {
                    
                if(error) throw error;
                
               res.redirect('/');
            });
        });
    }
});
});
});

//DELETE A GAME FROM USER CART 
app.get('/cart/:aid/delete', function(req, res){
    var stmt = 'DELETE from games WHERE games.gameId='+ req.params.aid + ';';
    connection.query(stmt, function(error, result){
        if(error) throw error;
        res.redirect('/');
    });
});

//ROUTE TO SHOW USERS CART
app.get('/cart', isAuthenticatedHome, function(req,res){
    
    var username = req.session.user;
    var statement = 'select userId ' +
               'from users ' +
               'where users.username=\'' 
                + username + '\';';
    
    connection.query(statement,function(error, results){
        
        if(error) throw error;
        
        var usersId = results[0].userId;
               
        var stmt = 'select * ' +
               'from games ' +
               'where games.userId=' 
                + usersId + ' and games.purchased=false;'; //,games.purchased=false;
               
    connection.query(stmt, function(error, results){
        
        if(error) throw error;
        
        res.render('cart', {gamesInfo:results});  //both name and quotes are passed to quotes view     
    });
});
});

app.put('/purchased/:gameId', function(req, res){
    
    //edit the user money, edit the game's bool 
    let username = req.session.user; //username
    var gameId = req.params.gameId;
    //return the user's money
    var statement = 'select * ' +
               'from users ' +
               'where users.username=\'' 
                + username + '\';';
                
    connection.query(statement, function(error,result){
        
        if(error) throw error;
        
        //this is the user's money
        var userMoney = result[0].userMoney;
        var userId = result[0].userId;
        
        //game with the userId -> copy of the game (doesn't have specific quantity) <- trying to update this 
        //but we should be updating the database gameId
        
        //database not the copy
        var stmt = 'select * ' +
               'from games ' +
               'where games.gameId=' 
                + gameId + ';';
        
        connection.query(stmt, function(error,result){
            
            if(error) throw error;
            
            //we have the game now with the price of the game
            
            var gamePrice = result[0].gamePrice;
            var quantity = result[0].quantity;
            var gameId = result[0].gameId;
            var gameName = result[0].name;
            var purchased;
            
            console.log(quantity);
            
            //subtract money from usersMoney
            if(userMoney>gamePrice&&userMoney-gamePrice>0){
                userMoney = userMoney - gamePrice;
                quantity = quantity -1;
                purchased = 1;
            }else{
                throw error;
            }
            
            //updates the copy
            var stmt = 'UPDATE users,games SET ' +
                'users.userMoney = "' +
                userMoney +
                '",' +
                'games.purchased = "' +
                purchased +
                '"' +
                ' WHERE users.userId='+userId +' and games.gameId=' +
                gameId +
                ';';
                
                connection.query(stmt, function(error, result) {
                    
                    if(error) throw error;
                    
                    //updates the copy
                var stmt = 'UPDATE games SET ' +
                    'games.quantity = "' +
                    quantity +
                    '"' +
                    ' WHERE games.userId IS NULL and games.name = "' + gameName + '";';
                    
                    connection.query(stmt, function(error, result) {
                        
                        if(error) throw error;
                        
                        res.redirect('/user');
                        
                });
            });
        });
    });
});

//ROUTE TO SHOW DATABASE GAMESLIST
app.get('/gameList', isAuthenticatedHome, function(req,res){
    
    var username = req.session.user;
    
    var statement = 'select userId ' +
               'from users ' +
               'where users.username=\''
                + username + '\';';
                
    connection.query(statement,function(error, results){
        
        if(error) throw error;
        
        var stmt = 'SELECT * from games where userId IS NULL and quantity>0;';
        
    connection.query(stmt, function(error, results){
        if(error) throw error;
        res.render('gameList',{gamesInfo : results});  //both name and quotes are passed to quotes view
    });
});
});

app.get('/randomGenerator', function(req, res){
    res.render('randomGenerator');
});

app.post('/randomGenerator', function(req, res){
    var stmt = 'SELECT * FROM games;';
    console.log(stmt);
    var games = null;
    connection.query(stmt, function(error, results){
        if(error) throw error;
        if(results.length) games = results;
        res.send(games);
        });
});

//CART
app.get('/cart', function(req, res){
    res.render('cart');
});

//Search
app.get('/search', function(req, res){
    res.render('search',{user: req.session.user});
});

app.get('/productDetail', function(req, res){
    res.render('productDetail',{user: req.session.user});
});

app.get('*', function(req, res){
    res.render('error');
});

//FUNCTIONS
//-------------------------------------------------------------------------------------------

function isAuthenticatedHome(req, res, next){
    if(!req.session.authenticated) res.render('home');
    else next();
}

//FUNCTION TO CHECK USERNAME AT LOGIN USING USERNAME PASSED INTO FUNCTION
function checkUsername(username){
    let stmt = 'SELECT * FROM users WHERE username=?';
    return new Promise(function(resolve, reject){
       connection.query(stmt,[username],function(error, results){
           if(error) throw error;
           resolve(results);
       }); 
    });
}

//FUNCTION TO CHECK PASSWORD AT LOGIN
function checkPassword(password, hash){
    return new Promise(function(resolve, reject){
       bcrypt.compare(password, hash, function(error, result){
          if(error) throw error;
          resolve(result);
       }); 
    });
}

//LISTENER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});