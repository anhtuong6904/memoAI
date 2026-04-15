const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const {CloudinaryStorage} = require('multer-storage-cloudinary');


require('dotenv').config();


cloudinary.config({
    cloud_name : process.env.cloud_name,
    api_key : process.env.api_key,
    api_secret : process.env.api_secret
})


///
//storage image file len cloudinary
const imageStorage = new CloudinaryStorage({
    cloudinary, 
    params: {
        folder: 'memoAI/images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
        transformation: [
            {width: 1200, crop: 'limit'},
            {quality: 'auto'}
        ]
    }
})


//storage audio file len cloudinary
const audioStorage = new CloudinaryStorage({
    cloudinary, 
    params: {
        folder: 'memoAI/audio',
        resource_type: 'video',
        allowed_formats: ['mp3', 'm4a', 'wav', 'ogg', 'webm'],
    }
})

//storage video file len cloudinary 
const videoStorage = new CloudinaryStorage({
    cloudinary, 
    params: {
        folder: 'memoAI/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm'],
    }
})

//file filter image, audio, video
const imageFilter = (req, file, cb) => {
    file.mimetype.startsWith('image/')
    ? cb(null, true)
    : cb(new Error('chi chap nhan file anh'), false);
}

const audioFilter = (req, file, cb) => {
    file.mimetype.startsWith('audio/')
    ? cb(null, true)
    : cb(new Error('chi chap nhan file audio'), false);
}

const videoFilter = (req, file, cb) => {
    file.mimetype.startsWith('video/')
    ? cb(null, true)
    : cb(new Error('chi chap nhan file video'), false);
}


//export middleware
//upload file 
const uploadImage = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {fileSize: 10 * 1024 * 1024} //10MB
}).single('image');

const uploadAudio = multer({
    storage: audioStorage,
    fileFilter: audioFilter,
    limits: {fileSize: 50 * 1024 * 1024} //10MB
}).single('audio');

const uploadVideo = multer({
    storage: videoStorage,
    fileFilter: videoFilter,
    limits: {fileSize: 100 * 1024 * 1024} //10MB
}).single('video');


module.exports = {uploadImage, uploadAudio, uploadVideo, cloudinary};
