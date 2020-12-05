const express = require('express');
const app = express(); 
const bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const uid = require('rand-token').uid; 
const bcrypt = require('bcryptjs'); 
const saltRounds = 10; 
const nodemailer = require("nodemailer"); 
require('dotenv').config()
const mongodb = require('mongodb'); 
const cors = require('cors'); 
app.proxy = true
const mongoClient = mongodb.MongoClient;
const url = process.env.MONGO_URL;

const allowedOrigins = ['https://zen-knuth-a6939d.netlify.app/', 'https://zen-knuth-a6939d.netlify.app/index.html', 'https://zen-knuth-a6939d.netlify.app/auth/resetpassword.html', 'https://zen-knuth-a6939d.netlify.app/auth/newpassword.html', 'https://zen-knuth-a6939d.netlify.app/signup.html', 'https://zen-knuth-a6939d.netlify.app/user/home.html', 'https://zen-knuth-a6939d.netlify.app/user/mylinks.html' , 'https://zen-knuth-a6939d.netlify.app/admin.html','https://zen-knuth-a6939d.netlify.app/user/dashboard.html']
app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(null, true)
        }
    }
}))

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

app.use(bodyParser.json());
app.use(cookieParser())


mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});

app.get("/", (req, res) => {
    res.send('hello from server');
    console.log("hello!");
});

app.get("/getusers",async (req, res) => {
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 

    let db = client.db("urlshortner"); 
    let user = db.collection("users"); 
    user.find({}).toArray((err, result) => {
        if (result) {
            return res.json({
                length: result.length
            })
        }
    });
});

app.get("/getlinks",async (req, res) => {
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    let db = client.db("urlshortner"); 
    let links = db.collection("links"); 
    links.find({}).toArray((err, result) => {
        if (result) {
            return res.json({
                length: result.length
            })
        }
    });
});

app.post("/adminlogin",async (req, res) => {
    const {
        email,
        password
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let user = db.collection("users"); 
    user.findOne({
        email: email
    }, (err, User) => {
        if (err) {
            return res.json({
                message: 'something went wrong',
                type_: 'danger'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            });
        } else {
            if (User.confirmed == true) {
                bcrypt.compare(password, User.password, function (err, result) { 
                    if (err) {
                        return res.json({
                            message: 'Something went wrong..',
                            type_: 'danger'
                        })
                    }
                    if (result == true) { 
                        let token = jwt.sign({
                            email: email
                        }, process.env.JWT_SECRET, {
                            expiresIn: '1h'
                        }); 
                        res.cookie('jwt', token, {
                            maxAge: 100000000000,
                            httpOnly: true,
                            sameSite: 'none',
                            secure: true
                        }).json({
                            type_: "success",
                            message: 'Logging in..',
                            user: email
                        })
                    } 
                    else {
                        return res.json({
                            message: 'Invalid Credentials..',
                            type_: 'warning'
                        })
                    }
                })
            }
        }
    })
});

app.post("/register", async (req, res) => {
    const {
        email,
        password
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let user = db.collection("users"); 
    user.findOne({
        email: email
    }, (err, result) => { 
        if (err) {
            return res.json({
                message: 'something went wrong',
                type_: 'danger'
            });
        }
        if (result == null) {
            bcrypt.hash(password, saltRounds, function (err, hash) { 
                if (err) {
                    return res.json({
                        message: 'something went wrong',
                        type_: 'danger'
                    });
                }
                user.insertOne({
                    email: email,
                    password: hash,
                    confirmed: false
                }, (err, result) => {

                    if (result) {
                        let emailToken = jwt.sign({
                            exp: Math.floor(Date.now() / 1000) + (60 * 60),
                            email: email
                        }, process.env.JWT_SECRET);

                        let url = `https://urlshortener-backend-heroku.herokuapp.com/auth/${emailToken}`
                        let name = `${email.split('@')[0]}`
                        
                        var mailOptions = {
                            from: process.env.EMAIL,
                            to: `${email}`,
                            subject: 'Account Confirmation Link',
                            html: `Hello ${name} , Here's your Account verification link: <br> <a style="color:green" href="${url}">Click Here To Confirm</a> <br> Link expires in an hour...`
                        };
                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                console.log(error)
                            } else {
                                return res.json({
                                    message: 'Check your mail and Confirm Identity...',
                                    type_: 'success'
                                }); 
                            }
                        });
                    }
                });
            });
        } else {
            return res.json({
                message: 'email already exists!!',
                type_: 'warning'
            });
        }
    })
});

app.post("/login", async (req, res) => {
    const {
        email,
        password
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let user = db.collection("users"); 
    user.findOne({
        email: email
    }, (err, User) => {
        if (err) {
            return res.json({
                message: 'something went wrong',
                type_: 'danger'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            });
        } else {
            if (User.confirmed == true) {
                bcrypt.compare(password, User.password, function (err, result) { 
                    if (err) {
                        return res.json({
                            message: 'Something went wrong..',
                            type_: 'danger'
                        })
                    }
                    if (result == true) {  
                        let token = jwt.sign({
                            email: email
                        }, process.env.JWT_SECRET, {
                            expiresIn: '1h'
                        });
                        res.cookie('jwt', token, {
                            maxAge: 1000000,
                            httpOnly: true,
                            secure: true
                        }).json({
                            type_: "success",
                            message: 'Logging in..',
                            user: email
                        })
                    } 
                    else {
                        return res.json({
                            message: 'Invalid Credentials..',
                            type_: 'warning'
                        })
                    }
                })
            } else {
                return res.json({
                    message: 'User Identity not Confirmed..',
                    type_: 'warning'
                })
            }
        }
    })
});

app.post("/resetpassword",  async (req, res) => {
    const {
        email
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner");
    let user = db.collection("users"); 
    user.findOne({ 
        email: email
    }, (err, users) => {
        if (users == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            }); 
        } else { 
           
            let emailToken = jwt.sign({
                email: email
            }, process.env.JWT_SECRET, {
                expiresIn: '10m'
            });
            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    confirmed: false
                }
            });
            let url = `https://urlshortener-backend-heroku.herokuapp.com/auth0/${emailToken}`
            let name = `${email.split('@')[0]}`

            var mailOptions = {
                from: process.env.EMAIL,
                to: `${email}`,
                subject: 'Password Reset Link',
                html: `Hello ${name} ,<br> Here's your password reset link: <a style="color:green" href="${url}">Click Here To Reset</a> Link expires in 10 minutes...`
            };

          
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    return res.json({
                        message: error,
                        type_: 'danger'
                    });
                } else {
                    return res.json({
                        message: 'Check your mail and Confirm Identity...',
                        type_: 'success'
                    }); 
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); 
        }
    })
});

app.post('/newpassword', async (req, res) => {
    const {
        password,
        email
    } = req.body; 
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner");
    let user = db.collection("users"); 
    user.findOne({
        email: email
    }, (err, User) => {
        if (err) {
            return res.json({
                message: 'Something Went Wrong',
                type_: 'warning'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            }); 
        } else {
            
            if (User.confirmed == true) {
                bcrypt.hash(password, saltRounds, function (err, hash) { 
                    if (err) {
                        return res.json({
                            message: err,
                            type_: 'danger'
                        });
                    } else {
                        user.findOneAndUpdate({
                            email: email
                        }, {
                            $set: {
                                password: hash 
                            }
                        }, (err, result) => {
                            if (err) {
                                return res.json({
                                    message: err,
                                    type_: 'danger'
                                });
                            }
                            if (result) {
                                return res.json({
                                    message: 'Password Reset Successfull',
                                    type_: 'success'
                                });
                            }
                        });
                    }

                })
            } else {
                return res.json({
                    message: 'Unauthorized Request',
                    type_: 'danger'
                });
            }
        }
    })

})

app.post("/bitlyFy", async (req, res) => {
    const {
        req_by,
        longLink
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let links = db.collection("links"); 
    const token = uid(5);
    let d = new Date();
    let date = d.getDate() + '-' + d.getMonth() + '-' + d.getFullYear();
    links.insertOne({
        longLink: longLink,
        shortLink: token,
        requestedBy: req_by,
        issuedOn: date
    }, (err, result) => {
        if (err) {
            return res.json({
                type_: 'danger',
                message: err
            });
        }
        if (result) {
            let shortlink = `https://urlshortener-backend-heroku.herokuapp.com/fy/${token}`
            return res.json({
                type_: 'success',
                message: 'Yippee It Works',
                shortLink: shortlink,
                date: date,
                longLink: longLink
            });
        }
    });
});

app.post("/MyLinks", async (req, res) => {
    const {
        user
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let links = db.collection("links"); 
    links.find({
        requestedBy: user
    }).toArray((err, result) => {
        if (result) {
            return res.json({
                result
            })
        }
    });
});

app.get("/auth0/:token", (req, res) => {
    const token = req.params.token
    jwt.verify(token, process.env.JWT_SECRET, async function (err, decoded) {
        if (decoded) {
            let client = await mongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            let db = client.db("urlshortner"); 
            let user = db.collection("users"); 
            user.findOneAndUpdate({
                email: decoded.email
            }, {
                $set: {
                    confirmed: true
                }
            }, (err, result) => {
                if (err) {
                    return res.json({
                        message: err,
                        type_: 'danger'
                    });
                }
                if (result) {
                    res.redirect('https://zen-knuth-a6939d.netlify.app/auth/newpassword');
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); 
        }
    });
});

app.get("/auth/:token", (req, res) => {
    const token = req.params.token
    jwt.verify(token, process.env.JWT_SECRET, async function (err, decoded) {
        if (decoded) {
            let client = await mongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            let db = client.db("urlshortner"); 
            let user = db.collection("users"); 
            user.findOneAndUpdate({
                email: decoded.email
            }, {
                $set: {
                    confirmed: true 
                }
            }, (err, result) => {
                if (err) {
                    return res.json({
                        message: err,
                        type_: 'danger'
                    });
                }
                if (result) {
                    res.redirect('https://zen-knuth-a6939d.netlify.app/Auth/confirmation.html');
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); 
        }
    });
});

app.get("/fy/:token", async (req, res) => {
    const {
        token
    } = req.params
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); 
    let db = client.db("urlshortner"); 
    let links = db.collection("links"); 
    links.findOne({
        shortLink: token
    }, (err, result) => {
        if (result != null) {
            res.redirect(result.longLink);
        }
    });
});

app.get('/checklogin', function (req, res) {
    const cooked = req.cookies
    console.log(cooked.jwt)
    jwt.verify(cooked.jwt, process.env.JWT_SECRET, function (err, decoded) {
        if (err) return res.json({
            type_: 'warning',
            message: 'session expired'
        });
        if (decoded) {
            return res.json({
                type_: 'success',
                message: 'Login Successful..'
            });
        } else {
            return res.json({
                type_: 'warning',
                message: 'Invalid Login..'
            });
        }
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie('jwt').json({
        type_: 'success',
        message: 'Logging Out...'
    })
});


app.listen(process.env.PORT || 8080, () => {
    console.log('Server is live.. 🔥')
})