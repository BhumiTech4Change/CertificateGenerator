const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const router = express.Router();
const { ensureAuthenticated } = require('./config/auth');
var zip = require('express-zip');
// const CronJob = require('cron').CronJob;
//After Integration
const imagesize = require('image-size')
const gm = require('gm')
const normalize = require('normalize-path');
const xlsx = require("xlsx")
const fs = require('fs')
const bodyparser = require('body-parser')
const multer = require('multer')
const path = require('path')
//Mail Packages
const AWS = require('aws-sdk');
const nodemailer = require('nodemailer');
const sesTransport = require('nodemailer-ses-transport');
//User model
const User = require('./models/User');
const Logs = require('./models/Logs');
const Mails = require('./models/Mails');
//Socket
var socket = require('socket.io');
require("dotenv").config();
const accessKeyId = process.env.accessKeyId;
const secretAccessKey = process.env.secretAccessKey;
const region = process.env.region;
const secret = process.env.secret;

//Font Addition Module
// const addFont = require('add-font');

const app = express();

// Passport config
require('./config/passport')(passport);

// Database Config
const db = require('./config/keys').MongoURI;
const { vers } = require('./routes/users');

// Connect to Mongo
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.log(err));

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');


//To redirect if user already logged in
function ensureNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.admin) {
            return res.redirect('/users/adminpage');
        }
        return res.redirect('/dashboard');
    }
    next();
}

//Making folders accessible thru server
app.use(express.static(__dirname))
// addFont('./assets/lucida_calligraphy_italic.ttf', 'lucida_calligraphy_italic');
//AWS Email Configuration
let transporter;
AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region,
    maxRetries: 1
});

const SES = new AWS.SES();
transporter = nodemailer.createTransport(sesTransport({
    ses: SES
}));

//GMAIL CONFIGURATION
// let transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 587,
//     secure: false,
//     requireTLS: true,
//     auth: {
//         user: 'apna email daal',
//         pass: 'apna password daal'
//     }
// });

// Body Parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Express Session
app.use(session({
    secret,
    resave: true,
    saveUninitialized: true
}));

//Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect Flash
app.use(flash());

// Global variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.validated_msg = req.flash('validated_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
})

// Routes
// app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));

//Welcome Page
app.get('/', ensureNotAuthenticated, (req, res) => res.render('welcome'));

//Dashboard
var email, emailIt,limit
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    email = req.user.email
    limit =req.user.limit
    emailIt = email
    module.exports.emailIt = emailIt //for sending email var to users.js
    console.log(typeof (email))
    console.log(req.user)
    res.render('dashboard', {
        name: req.user.name,
        lim: req.user.limit
    })
    var diri = "uploads"
    var diri2 = "modified"
    if (!fs.existsSync(diri)) {
        fs.mkdirSync(diri)
    }
    if (!fs.existsSync(diri2)) {
        fs.mkdirSync(diri2)
    }
})

//RESETTING LIMIT EVERY MID-NIGHT
// var job = new CronJob('0 0 * * *', function() {
//   User.find({ valid:true }).then(users => {
//     users.forEach(function(user){
//         user.limit = user.fixedLimit;
//         user.save();
//     })
//   })
// }, null, true, 'Asia/Kolkata');
// job.start();


//Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
        // cb(null, email + '-' + file.originalname)
    }
})

//Storage Configuration for Fonts Faces
const storageFont = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'assets')
    },
    filename: (req, file, cb) => {
        // cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
        cb(null, file.originalname)
    }
})

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.gif' && ext !== '.jpeg') {
            return callback(new Error('Only images are allowed'))
        }
        callback(null, true)
    }
})

const uploadExcel = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if (ext !== '.xls' && ext !== '.xlsx' && ext !== '.csv' && ext !== '.dbf') {
            return callback(new Error('Only Excel Sheet and csv files are allowed'))
        }
        callback(null, true)
    }
})

const uploadFont = multer({
    storage: storageFont,
    fileFilter: function (req, file, callback) {
        var ext = path.extname(file.originalname);
        if (ext !== '.ttf') {
            return callback(new Error('Only Excel Sheet and csv files are allowed'))
        }
        callback(null, true)
    }
})

const uploadTxt = multer({
    storage: storage,
    fileFilter: function( req, file, callback) {
        var ext = path.extname(file.originalname);
        if(ext != '.txt') {
            return callback(new Error('Only text file allowed'))
        }
        callback(null, true)
    }
})

//Retrieve Fonts
let fonts = [];
let dir = __dirname + '/assets/'
// console.log(__dirname)

//global variables
var globalImg, tempWidth, tempHeight
//Upload the Certificate Image
app.post('/uploadCertificate', upload.single('image'), (req, res, next) => {
    if (!req.file) {
        res.send("Please Upload an image")
    }
    else {
        var correctPath = normalize(req.file.path)
        console.log(correctPath)
        const dimensions = imagesize(req.file.path)
        var widthO = dimensions.width
        var heightO = dimensions.height
        const ratio = widthO / heightO
        console.log(widthO + " lol: " + heightO + " blahblah " + ratio)
        if (widthO > 800) {
            widthO = 800
            heightO = widthO / ratio
        }
        tempWidth = widthO
        tempHeight = heightO
        globalImg = req.file.filename
        var boxNo = 0
        res.render('image.ejs', { url: correctPath, name: req.file.filename, width: widthO, height: heightO, keys: keys, boxNo: boxNo, fonts: fonts })
        // res.send("Image Uploaded")
    }
})

// var imagery;
var k = 0
var GlobalModifiedLatestImg, globalImgData = [], globalImgDataAllBoxes = [], max
//Add another Box Property
app.post('/trialItUp/:path/:no', (req, res) => {
    //date naming
    var d = new Date()
    var day = d.getDate()
    var month = d.getMonth()
    var year = d.getFullYear()
    var time = d.getTime()
    var urlImg = req.params.path
    var boxNo = parseInt(req.params.no)
    //getting orig image path n getting its orig dim which is used in calc. the coordinates
    console.log("this is the 1st alfa:" + urlImg[0])
    var image
    var dir = './modified/' + email
    var dir2 = '/modified/' + email
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    if (k == 0 || urlImg[0] != 'o') {
        image = "./uploads/" + urlImg
        k++
    }
    else {
        image = dir + '/' + urlImg
        // image = "./modified/" + urlImg
    }
    // imagery = image
    console.log("This is the params:" + req.params.path)
    const dimensions = imagesize(image)
    const origWidth = dimensions.width
    const origHeight = dimensions.height
    console.log("Brosky Dosky" + origWidth)

    // //Getting form data from ejs
    var fontColor = req.body.fontColor
    var fontSize = req.body.fontSize
    var selection = req.body.e
    var selectionFonts = req.body.f
    mrX = (req.body.a) * origWidth / tempWidth;
    mrY = (req.body.b) * origHeight / tempHeight;
    mrWidth = (req.body.c) * origWidth / tempWidth;
    mrHeight = (req.body.d) * origHeight / tempHeight;
    var obj = {
        "fontColor": fontColor,
        "fontSize": fontSize,
        "mrX": mrX,
        "mrY": mrY,
        "mrWidth": mrWidth,
        "mrHeight": mrHeight,
        "selection": selection,
        "selectionFonts": selectionFonts
    }
    globalImgData[boxNo] = obj
    globalImgDataAllBoxes = []
    for (var i = 0; i <= boxNo; i++) {
        globalImgDataAllBoxes.push(globalImgData[i])
        console.log("So this is the End Game:\n" + globalImgData[i].selection + "\nThis is God!:\n" + globalImgDataAllBoxes[i].selection)
    }
    console.log("this is the box Data Dammit!" + globalImgData[0].selection)
    boxNo++
    max = boxNo
    console.log(obj)
    console.log("this is the selection:" + selection + "\n" + typeof (selection))
    // coorObj = JSON.parse(req.body.e)
    // console.log("Lets See how the trial looks like:\n" + coorObj.a)
    const img = gm(image)
        .fill(fontColor)
        .font('./assets/' + selectionFonts + '.ttf', fontSize)
    // img.resize(width, height)
    // console.log("xx:" + xx + "\n" + "yy:" + yy)

    // if(selection=="Paragraph"){
    //    img.region(mrWidth, mrHeight, mrX, mrY).drawText(0, mrHeight / 8, paraData, 'south');
    // } else{
        img.region(mrWidth, mrHeight, mrX, mrY).drawText(0, mrHeight / 8, onePersonData[selection], 'center');
    //}

    var filename = 'output' + '-' + time + '.png'
    var outputImgPath = dir2 + '/' + filename
    GlobalModifiedLatestImg = dir + '/' + filename
    // Getting out img path n showing that img in preview.ejs, also sending the img dimensions

    var widthO = dimensions.width
    var heightO = dimensions.height
    const ratio = widthO / heightO
    // console.log(widthO + " lol: " + heightO + " blahblah " + ratio)
    if (widthO > 800) {
        widthO = 800
        heightO = widthO / ratio
    }

    //Appliying effects over the image
    img.write(GlobalModifiedLatestImg, err => {
        if (err) return console.error(err);
        console.log(outputImgPath)
        console.log('done');
        res.render('image.ejs', { url: outputImgPath, name: filename, width: widthO, height: heightO, keys: keys, boxNo: boxNo, fonts: fonts })
    });
})

var certData = []
//Generate and email all the certificates
app.post('/generateCertificates', async (req, res) => {
    //date naming
    var d = new Date()
    var day = d.getDate()
    var month = d.getMonth()
    var year = d.getFullYear()
    //getting orig image path n getting its orig dim which is used in calc. the coordinates
    var image = "./uploads/" + globalImg //Imp, the path of the blank Certificate
    var dir = './modified/' + email
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    var certCount = 0
    certData = []
    zipper = []
    // res.setHeader('Content-Type', 'text/html');
    for (var j = 0; j < allPeopleData.length; j++) {
        var img = gm(image)
        var nameOne = allPeopleData[j][keyArr[1]]
        // var emailOne = allPeopleData[j].Email
        // var outputImgPath = dir + '/' + item.Name + '-' + Date.now() + '.png'
        for (var i = 0; i < max; i++) {
            localSelection = globalImgDataAllBoxes[i].selection
            img.fill(globalImgDataAllBoxes[i].fontColor)
            img.font('./assets/' + globalImgDataAllBoxes[i].selectionFonts + '.ttf', globalImgDataAllBoxes[i].fontSize)
            // img.resize(width, height)
            // console.log("xx:" + xx + "\n" + "yy:" + yy)

            // if(localSelection=="Paragraph"){
            //    img.region(globalImgDataAllBoxes[i].mrWidth, globalImgDataAllBoxes[i].mrHeight, globalImgDataAllBoxes[i].mrX, globalImgDataAllBoxes[i].mrY).drawText(0, (globalImgDataAllBoxes[i].mrHeight) / 8, paraData, 'south');
            // }
            // else{
                img.region(globalImgDataAllBoxes[i].mrWidth, globalImgDataAllBoxes[i].mrHeight, globalImgDataAllBoxes[i].mrX, globalImgDataAllBoxes[i].mrY).drawText(0, (globalImgDataAllBoxes[i].mrHeight) / 8, allPeopleData[j][localSelection], 'south');
            //}

        }
        // console.log("This shud be selection:" + allPeopleData[j][localSelection])
        console.log("CHECK____ : ", localSelection)
        console.log("Text written for+" + allPeopleData[j][keyArr[1]])
        var outputImgPath = dir + '/' + allPeopleData[j][keyArr[1]] + '-' + day + '-' + month + '-' + year + '.png'
        var outputPdfPath = dir + '/' + allPeopleData[j][keyArr[1]] + '-' + day + '-' + month + '-' + year + '.pdf'
        zipper.push({
            "path": outputPdfPath,
            "name": allPeopleData[j][keyArr[1]] + '.pdf'
        })
        certData.push({
            "Name": allPeopleData[j][keyArr[1]],
            "Email": allPeopleData[j][keyArr[0]],
            "path": outputPdfPath
        })
        img.write(outputPdfPath, async (err) => {
            if (err) return console.error(err);
            certCount++
            console.log('done making Certificates 4 ' + certCount);
            // res.write('Generated certificate for'+certCount)
            if (certCount == allPeopleData.length) {
                res.json({
                    success: true,
                    email: email
                })
            }
        });
    }
})
// user.limit = user.limit - certData.length;
//                 console.log("New User Limit: " + user.limit);
//                 user.save();

// app.post('/sendMails', (req, res) => {
//     var counter = 0;
//     var fromEmail = req.body.fromEmail
//     var sub = req.body.sub
//     var cont = req.body.content
//     var bcc = req.body.bcc
//     if(limit < certData.length) {
//         res.status(205).send()
//     }
//     else {
//         certData.forEach((item, index) => {
//             let mailOptions = {
//                 from: fromEmail,
//                 to: item.Email,
//                 bcc: bcc,
//                 subject: sub,
//                 text: 'Dear ' + item.Name + "\n" + cont,
//                 attachments: {
//                     path: item.path,
//                 }
//             }
//             transporter.sendMail(mailOptions, (error, info) => {
//                 if (error) {
//                     res.status(206).send()
//                     return console.log(error.message);
//                 }
//                 counter++;
//                 if (counter == certData.length) {
//                     limit = limit - counter;
//                     User.findOne({ email: email })
//                     .then(user => {
//                         user.limit = limit;
//                         user.save();
//                     })
//                     res.status(204).send()
//                 }
//                 console.log('success');
//             });
//         })
//     }
// })

function waiter() {
    console.log("Lets wait for three sec")
}
//Download api for downloading all the certifcates generated
app.get('/download', (req, res) => {
    res.zip(zipper)
})

//Uploading the Excel Sheet
var keys, onePersonData, allPeopleData
var keyArr = []
app.post('/resize/uploads/excel', uploadExcel.single('excel'), (req, res, next) => {
    if (!req.file) {
        res.send("Please Upload an excel file!")
    }
    else {
        //Font configurations
        fs.readdir(dir, function (err, files) {
            // if (err)
            //     return done(err, fonts);
            console.log("these r files:" + files)
            fonts = files.map(function (file) {
                return path.join(dir, file);
            }).filter(function (file) {
                return path.extname(file) === '.ttf';
            }).map(function (file) {
                return path.basename(file, '.ttf')
            });
            console.log(fonts)
        });

        var excelFilePath = 'uploads/' + req.file.filename
        // console.log("So it works in Excel:" + req.params.path)
        //Reading and Extracting Files!
        var wb = xlsx.readFile(excelFilePath)
        var ws = wb.Sheets[wb.SheetNames[0]]
        console.log("SHEET NAME: ", wb.SheetNames[0])
        var data = xlsx.utils.sheet_to_json(ws, { raw: false })
        allPeopleData = data
        onePersonData = data[0]
        data.forEach((item) => {
            keyArr = Object.keys(item);
            console.log("key ARR: ", keyArr);
        })
        console.log("So this is the data[0]:" + onePersonData[keyArr[1]])
        // allPeopleData.forEach((person)=>{
        //     console.log(`allPeopleData individual: `, person)
        // })
        console.log("getting mail from allPeopleData: ", allPeopleData[0][keyArr[0]])
        // console.log("data is: ",data)

        keys = [];
        // console.log(flag)
        // if(flag==1){
            // keys = ["Paragraph"];
        // }
        for (var k in data[0]) {
            // console.log("k in data[0] is: ",k)
            keys.push(k)
        }
        console.log("total:" + keys.length + "keys:" + keys[0])
        //Able to extract the Name values
        // data.forEach((item) => {
        //     console.log(item)
        // })
        console.log("Uploaded the " + req.file.filename + " file")
        res.status(204).send()
    }
})

//Upload Font Faces
app.post('/uploadingFont', uploadFont.single('fontFamiliy'), (req, res, next) => {
    if (!req.file) {
        res.send("Please Upload an ttf font file!")
    }
    else {
        res.status(204).send()
    }
})

// var paraData;
// app.post('/textupload', uploadTxt.single('text'), (req, res, next) => {
//     if(!req.file){
//         res.send("Please upload an txt file")
//     }
//     else {
//         var textFilePath = 'uploads/' + req.file.filename
//         console.log("FILE NAME: ", req.file.originalname)
//         fs.readFile(textFilePath, 'utf-8', function(err, data) {
//             if(err){
//                 console.log(err)
//             }
//             else {
//                 paraData = data;
//                 keys.push("Paragraph");
//             }
//         })
//         res.status(204).send()
//     }
// })

const PORT = process.env.PORT || 5500;

var server = app.listen(PORT, console.log(`Server started on ${PORT}`));

//Socket Setup
var io = socket(server)
let loggs = [];
let mails = [];
var mailid;
io.on('connection', function (socket) {
    console.log("Made a socket Connection!", socket.id)
    socket.on('chat', (data) => {
        if (limit < certData.length) {
            socket.emit('chat', {
                limitMessage: 'Your limit to send mails has expired! Kindly ask admin if you want to send more.'
            })
        }
        else {
            var counter = 0
            var dec = 0
            // delay for the setinterval
            let delay = 200;
            // certData.forEach((item, index) => {
                // console.log("Individual Iteam inside certData: ",item)
                let interval = setInterval(()=>{
                    if(counter<certData.length){
                        let mailOptions = {
                            from: data.fromEmail,
                            // to: item.Email,
                            to: certData[counter].Email,
                            cc: data.cc,
                            bcc: data.bcc,
                            subject: data.sub,
                            // text: 'Dear ' + item.Name + "\n" + data.content,
                            text: 'Dear ' + certData[counter].Name + "\n" + data.content,
                            attachments: {
                                // path: item.path,
                                path: certData[counter].path
                            }
                        }
                        transporter.sendMail(mailOptions, (error, info) => {
                            if (error) {
                                // res.status(206).send()
                                // return console.log(error.message);
                                counter++;
                                dec++;
                                console.log("testtt: ", error.message);
                                socket.emit('chat', {
                                    wrongEmails: mailOptions.to,
                                    count: counter,
                                    total: certData.length
                                })
                                mails.push({
                                    "toEmail": mailOptions.to,
                                    "error": error.message,
                                    "category": "ERROR"
                                });
                            }
                            else {
                                counter++;
                                socket.emit('chat', {
                                    count: counter,
                                    total: certData.length,
                                    limitMessage: '',
                                    wrongEmails: ''
                                })
                                console.log("INFO : ", info);
                                mails.push({
                                    "toEmail": mailOptions.to,
                                    "msgID": info.messageId,
                                    "category": "SENT"
                                });
                            }
                            if (counter == certData.length) {
                                socket.disconnect(true);
                                limit = limit - counter;
                                User.findOne({ email: email })
                                .then(user => {
                                    user.limit = limit;
                                    user.date = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
                                    user.certsent = counter - dec;
                                    user.totalSent = user.totalSent + counter - dec;
                                    user.save();
                                    const newLog = new Logs({ user: user });
                                    newLog.save()
                                    .then(logs => {
                                        loggs.reverse();
                                        loggs.push(logs);
                                        loggs.reverse();
                                        mailid = logs.id;
                                        console.log("MAILS: ", mails);
                                        console.log("mID: ",mailid);
                                        const newMail = new Mails({ mailID: mailid, mails: mails })
                                        newMail.save()
                                        mails = [];
                                    });
                                    const i = vers.findIndex(ver => ver.id == user.id);
                                    if (i > -1) {
                                        vers[i].limit = user.limit;
                                        vers[i].totalSent = user.totalSent;
                                    }
                                })
                                // console.log("MAILS: ", mails);
                                // console.log("ID",mailid);
                                // const newMail = new Mails({ mailID: mailid, mails: mails })
                                // newMail.save()
                            }
                            console.log('success');
                        });
                    }else{
                        clearInterval(interval)
                    }
                },delay)
            // })
        }
        // for (let i = 0; i < 5; i++) {
        //     task(i,data);
        // }
    })

    // function task(i,data) {
    //     setTimeout(function () {
    //         // Add tasks to do
    //         // res.write('<h1>This is the response #: ' + i + '</h1>');
    //         console.log("Emailer:"+data.sub+"-"+ i)
    //         socket.emit('chat', {
    //             iterateVal: i
    //         })
    //         if (i == 4) {
    //             socket.disconnect(true);
    //             // res.end()
    //         }
    //     }, 2000 * i);
    // }
})
module.exports.loggs = loggs;
module.exports.mails = mails;