require('dotenv').config();
const pool = require('./db'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const express= require('express');

const app = express();
app.use(express.json());
let uid=1;



const verifyToken= (req,res,next)=>{
    const authHeader = req.headers['authorization'];

    const token = authHeader && authHeader.split(' ')[1];

    if(!token) return res.status(401).json({msg:"Access Denied: no token provided"});
    try{
        const verifiedData = jwt.verify(token, process.env.JWT_SECRET);

        req.user = verifiedData; 

        next();

    }catch(error){
        return res.status(403).json({ msg: "Invalid or expired token." });
    }
}

const validateStatus=(req,res,next)=>{
    let status = req.body.status || req.params.status;
    if(status) status= status.toUpperCase();
    if(status && status!="TO-DO"&& status!="IN PROGRESS" && status!="COMPLETED"){
        return res.status(400).json({msg:"the status is invalid"})
    }
    return next();
}

app.post('/api/register',async(req,res)=>{
    try{
        const{name,email,password} =req.body;
        if(!name|| !email|| !password)
            return res.status(400).json({msg:"please input name,password and email"});

        const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (existingUsers.length > 0) 
            return res.status(400).json({ msg: "A user with this email already exists." });
        
        const round =10;
        const hashedPass = await bcrypt.hash(password,round);

        const [result]= await pool.query(
            "INSERT INTO users (name,email,password) VALUES(?,?,?)",
            [name,email,hashedPass]
        );

        return res.status(201).json({
            msg: "User successfully registered!",
            userId: result.insertId
        });
    }catch(error){
        return res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});

app.post('/api/login',async(req,res)=>{
    try{
        const{email,password} = req.body;
        if(!email || !password)
            return res.status(400).json({msg:"please input email and password"});
        const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

        if(users.length<1) return res.status(400).json({msg:"invalid email or password"});

        const user = users[0];
        const validPass = await bcrypt.compare(password,user.password);

        if(!validPass) return res.status(400).json({msg:"invalid email or password"});

        const payload ={
            id: user.id,
            name: user.name,
            email: user.email
        }
        const token = jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:"1h"});

        return res.status(200).json({msg:"login successful", token});
    }catch(error){
        return res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});

app.post('/api/tasks',verifyToken,validateStatus,async(req,res)=>{
    try{

        let{title,description='',status="TO-DO"}= req.body;
        if(!title){
           return  res.status(400).json({msg:"the task needs a title"});
        }
        const user = req.user;
        if(status) status= status.toUpperCase();

        const [result] = await pool.query(
            "INSERT INTO tasks (title, description, status, user_id) VALUES (?, ?, ?, ?)",
            [title, description, status, user.id]
        );

        res.status(201).json({msg:"the task created successfully", task: { id: result.insertId, title, description, status, user_id: user.id }});

    }catch(error){
        res.status(500).json({msg:"internal server error", err:`${error}`});
    }

});

app.get('/api/tasks',verifyToken,async(req,res)=>{
    try{
        const user = req.user;
        const [tasks] = await pool.query("SELECT * FROM tasks WHERE user_id = ?", [user.id]);
        res.status(200).json(tasks);
    }catch(error){
        res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});

app.delete('/api/tasks/:id',verifyToken,async(req,res)=>{
    try{
        const user = req.user;
        if(!req.params.id){
            return res.status(400).json({msg:"id cant be null"});
        }
        const [task] = await pool.query("SELECT * FROM tasks WHERE user_id =? and id = ? ",
            [user.id,req.params.id]
        );
        if(task.length<1) return res.status(404).json({msg:"the task with this id not found"}) ;

        const [Deleted]= await pool.query(
            `DELETE FROM tasks 
             WHERE id=? and user_id=? `,
             [req.params.id,user.id]
        );
        res.status(200).json({msg:"the task was deleted successfully"})
    }catch(error){
        res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});


app.put('/api/tasks/:id',verifyToken,validateStatus,async(req,res)=>{
    try{

        const user=req.user;
        const taskId= req.params.id;
    
        if(!taskId){
            return res.status(400).json({msg:"the task id is required"});
        }
        const fields=[];
        const values=[];

        const {title,description,status} = req.body ;
        if(title){
            fields.push("title=?");
            values.push(title);
        }
        if(description){
            fields.push("description=?");
            values.push(description);
        }
        if(status){
            fields.push("status=?");
            values.push(status.toUpperCase());
        }
        const sql = `UPDATE tasks 
                    SET ${fields.join(", ")} 
                    WHERE id=? AND user_id=?`;
        values.push(taskId,user.id);
        
        const [result]= await pool.query(
            `UPDATE tasks
            SET ${fields.join(", ")}
            WHERE id=? AND user_id=?`,
            values
        );
        if(result.affectedRows===0){
            return res.status(404).json({msg:"the task with this id not found"});
        }
        res.status(200).json({msg:"the task was updated successfully"});
    }catch(error){
        res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});


app.get('/api/tasks/filter/:status',verifyToken,validateStatus,async(req,res)=>{
    try{
        const user = req.user;
        const {status} = req.params;
        if(!status) return res.status(400).json({msg: "Please enter a status to filter by"})
        const [tasks] = await pool.query(
            `SELECT * From tasks 
            Where user_id =? AND status=?
            `,[user.id,status.toUpperCase()]
        );
        res.status(200).json(tasks)

    }catch(error){
          res.status(500).json({msg:"internal server error", err:`${error}`});
    }
    
});

app.get('/api/tasks/search',verifyToken,async(req,res)=>{
    try{

        const {q} = req.query;
        const user = req.user;
    
        const [task]= await pool.query(
            `SELECT * FROM tasks 
             Where title LIKE ? AND user_id=?`,
             [`%${q}%`,user.id]
        );
        res.status(200).json(task);
    }
    catch(error){
        res.status(500).json({msg:"internal server error", err:`${error}`});
    }
});


app.listen(3000,()=>console.log('the server is running on port 3000'));