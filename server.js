// name: Samarth Shaileshkumar Patel
var express = require("express");
var multer = require("multer");
var clientSessions = require("client-sessions");
var app = express();
var path = require("path");
var data_service = require("./data-service.js");
var dataServiceAuth = require("./data-service-auth.js");
const fs = require('node:fs');
var exphbs = require("express-handlebars");

var HTTP_PORT = process.env.PORT || 8080;
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//setup client-sessions
app.use(clientSessions({
    cookieName: "session", // this is the object name that will be added to "req"
    secret: "This_should_Be_A_Long_unguessableString", //this should be a long-unguessable string.
    duration: 2 * 60 * 1000, //duration of the session in milliseconds (2 mins)
    activeDuration: 1000 * 60 //the session will be extended by this many milliseconds each request (1 min)
}));

app.use(function (req, res, next) {
    res.locals.session = req.session;
    next();
});



app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    defaultLayout: "main",
    helpers: {
        navLink: function (url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href=" ' + url + ' ">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    }
}));

app.set("view engine", ".hbs");

function onHttpStart() {
    console.log("Express http server listening on: " + HTTP_PORT);
}

const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

//tell multer to utilize disk storage function when naming files rather than default
const upload = multer({ storage: storage });

data_service.initialize()
    .then(dataServiceAuth.initialize)
    .then(function () {
        app.listen(HTTP_PORT, function () {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    });

app.use(express.static('public'));

app.use(function (req, res, next) {
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.get("/", (req, res) => {
    //res.sendFile(path.join(__dirname,"/views/home.html"));
    //sending the proper css wanted to default template
    res.render("home", { style: 'site.css' });
});

app.get("/about", (req, res) => {
    //res.sendFile(path.join(__dirname,"/views/about.html"));
    res.render("about", { style: 'site.css' });
});

app.get("/employees", ensureLogin, (req, res) => {

    if (req.query.status) {
        data_service.getEmployeesByStatus(req.query.status).then((data) => {
            if (data.length > 0) res.render("employees", { employees: data, style: 'site.css' });
            else res.render("employees", { message: "no results" });
        }).catch((err) => {
            res.render("employees", { message: "no results" });
        });
    }
    else if (req.query.department) {
        data_service.getEmployeesByDepartment(req.query.department).then((data) => {
            if (data.length > 0) res.render("employees", { employees: data, style: 'site.css' })
            else res.render("employees", { message: "no results", style: 'site.css' });
        }).catch((err) => {
            res.render("employees", { message: "no results", style: 'site.css' });
        });
    }
    else if (req.query.manager) {
        data_service.getEmployeesByManager(req.query.manager).then((data) => {
            if (data.length > 0) res.render("employees", { employees: data, style: 'site.css' });
            else res.render("employees", { message: "no results", style: 'site.css' });
        }).catch((err) => {
            res.render("employees", { message: "no results", style: 'site.css' });
        });
    }
    else {
        data_service.getAllEmployees().then((data) => {
            if (data.length > 0) res.render("employees", { employees: data, style: 'site.css' });
            else res.render("employees", { message: "no results", style: 'site.css' });
        }).catch((err) => {
            res.render({ message: "no results", style: 'site.css' })
        });
    }

});


app.get("/departments", ensureLogin, (req, res) => {
    data_service.getDepartments().then((data) => {
        if (data.length > 0) res.render("departments", { departments: data, style: 'site.css' })
        else res.render("departments", { message: "no results" });
    }).catch((err) => {
        res.render("departments", { message: "no results" })
    });
});

app.get("/departments/add", ensureLogin, (req, res) => {
    res.render("addDepartment", { style: 'add.css' });
});

app.post("/departments/add", ensureLogin, (req, res) => {
    const formData = req.body;
    data_service.addDepartment(formData).then(() => {
        res.redirect("/departments");
    }).catch((err) => {
        res.status(500).render("error", { layout: false, errorCode: "500", message: "Unable to Add Department" });
    });
})

app.get("/employees/add", ensureLogin, (req, res) => {
    data_service.getDepartments().then((data) => {
        res.render("addEmployee", { departments: data, style: 'add.css' });
    }).catch((err) => {
        res.render("addEmployee", { departments: [] })
    });

});

app.get("/images/add", ensureLogin, (req, res) => {
    //res.sendFile(path.join(__dirname,"/views/addImage.html"));
    res.render("addImage", { style: 'add.css' });
});

app.post("/images/add", ensureLogin, upload.single("imageFile"), (req, res) => {
    res.redirect("/images");
});

app.get("/images", ensureLogin, (req, res) => {
    fs.readdir("./public/images/uploaded", function (err, items) {
        var imageList = {};
        imageList.images = items;
        res.render("images", { imageList: imageList, style: 'add.css' });
    });
});

app.post("/employees/add", ensureLogin, (req, res) => {
    const formData = req.body;
    data_service.addEmployee(formData).then(() => {
        res.redirect("/employees");
    }).catch((err) => {
        res.status(500).render("error", { layout: false, errorCode: "500", message: "Unable to Add Employee" });
    });


});

app.get("/employee/:empNum", ensureLogin, (req, res) => {
    // initialize an empty object to store the values
    let viewData = {};
    data_service.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null if none were returned
        }
    }).catch(() => {
        viewData.employee = null; // set employee to null if there was an error 
    }).then(data_service.getDepartments)
        .then((data) => {
            viewData.departments = data; // store department data in the "viewData" object as "departments"
            // loop through viewData.departments and once we have found the departmentId that matches
            // the employee's "department" value, add a "selected" property to the matching 
            // viewData.departments object
            for (let i = 0; i < viewData.departments.length; i++) {
                if (viewData.departments[i].departmentId == viewData.employee.department) {
                    viewData.departments[i].selected = true;
                }
            }
        }).catch(() => {
            viewData.departments = []; // set departments to empty if there was an error
        }).then(() => {
            if (viewData.employee == null) { // if no employee - return an error
                res.status(404).render("error", { layout: false, errorCode: "404", message: "Employee Not Found" });
            } else {
                res.render("employee", { viewData: viewData, style: 'add.css' }); // render the "employee" view
            }
        });
});


app.get("/department/*", ensureLogin, (req, res) => {
    data_service.getDepartmentById(req.params[0]).then((data) => {
        if (data) //if not undefined
            res.render("department", { department: data, style: 'add.css' });
        else
            res.status(404).render("error", { layout: false, errorCode: "404", message: "Department Not Found" });
    }).catch((err) => {
        res.status(404).render("error", { layout: false, errorCode: "404", message: "Department Not Found" });;
    });
});

app.post("/employee/update", ensureLogin, (req, res) => {
    data_service.updateEmployee(req.body).then(() => {
        res.redirect("/employees");
    }).catch((err) => {
        res.status(500).render("error", { layout: false, errorCode: "500", message: "Unable to Update Employee" });
    });

});

app.post("/department/update", ensureLogin, (req, res) => {
    data_service.updateDepartment(req.body).then(() => {
        res.redirect("/departments");
    }).catch((err) => {
        res.status(500).render("error", { layout: false, errorCode: "500", message: "Unable to Update Department" });
    });

});

app.get("/employees/delete/*", ensureLogin, (req, res) => {
    data_service.deleteEmployeeByNum(req.params[0]).then(() => {
        res.redirect("/employees");
    }).catch((err) => {
        res.status(500).render("error", { layout: false, errorCode: "500", message: "Unable to Remove Employee / Employee not found" });
    });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    dataServiceAuth.registerUser(req.body).then(() => {
        res.render("register", { successMessage: "User created" });
    }).catch((err) => {
        res.render("register", { errorMessage: err, userName: req.body.userName });
    });
});

app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    dataServiceAuth.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName, // complete it with authenticated user's userName
            email: user.email, // complete it with authenticated user's email
            loginHistory: user.loginHistory // complete it with authenticated user's loginHistory
        }
        res.redirect("/employees");
    }).catch((err) => {
        res.render("login", { errorMessage: err, userName: req.body.userName });
    });
});

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});

//get any other route that is not found
app.get("*", (req, res) => {
    res.status(404).render("error", { layout: false, errorCode: "404", message: "Page Not Found" });
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}
