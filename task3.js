const express= require('express');
const app = express();
app.use(express.json());
let uid=1;

let tasks=[];

const validateStatus=(req,res,next)=>{
    let {status} = req.body;
    if(status) status= status.toUpperCase();
    if(status && status!="TO-DO"&& status!="IN PROGRESS" && status!="COMPLETED"){
        return res.status(400).json({msg:"the status is invalid"})
    }
    return next();
}

app.post('/api/tasks',validateStatus,(req,res)=>{
    try{

        let{title,description='',status="TO-DO"}= req.body;
        if(!title){
           return  res.status(400).json({msg:"the task needs a title"});
        }
        if(status) status= status.toUpperCase();

        const newTask={
            id:uid++,
            title,
            description,
            status:status||"TO-DO"
        };

        tasks.push(newTask);
        res.status(201).json({msg:"the task created successfully",task:newTask});

    }catch(error){
        res.status(500).json({msg:"internal server error"});
    }

});

app.get('/api/tasks',(req,res)=>{
    try{
        res.status(200).json(tasks);
    }catch(error){
        res.status(500).json({msg:"internal server error"});
    }
});

app.put('/api/tasks/:id',validateStatus,(req,res)=>{
    try{
        if(!req.params.id){
            return res.status(400).json({msg:"id cant be null"});
        }
        let {title,description,status} = req.body;
        if(status) status= status.toUpperCase();
        let f= 0;
        tasks.forEach(task => {
            if(task.id==req.params.id){
                f=1; 
                task.title = title|| task.title;
                task.description=description||task.description;
                task.status=status||task.status;
                res.status(200).json({msg:`the task ${req.params.id} updated successfully`});
            }
        });
        if(!f){
            res.status(404).json({msg:`the task ${req.params.id} not found`})
        }
    }catch(error){
        res.status(500).json({msg:"internal server error"});
    }
});


app.delete('/api/tasks/:id',(req,res)=>{
    const {id} = req.params;
    if(!id){
        return res.status(400).json({msg:"id cant be null"});
    }
    const exist = tasks.some((task)=> task.id==id);
    if(!exist){
        return res.status(404).json({msg:`the task ${id} not found`});
    }
    tasks=tasks.filter((task)=> task.id!=id);
    res.status(200).json({msg:`the task ${id} deleted successfully`});
});


app.get('/api/tasks/filter/:status',validateStatus,(req,res)=>{
    let {status} = req.params;
    if(status) status= status.toUpperCase();

    const filteredTasks = tasks.filter((task)=> task.status==status);

    res.status(200).json(filteredTasks);
});

app.get('/api/tasks/search',(req,res)=>{
    const {q} = req.query;
    if(!q){
        return res.status(400).json({msg:"the search query cant be null"});
    }
    const filteredTasks = tasks.filter((task)=> task.title.includes(q) || task.description.includes(q));
    res.status(200).json(filteredTasks);
});


app.listen(3000,()=>console.log('the server is running on port 3000'));