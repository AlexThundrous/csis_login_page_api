// Import required modules
import express from 'express';
import knex from 'knex';
import cors from 'cors';
// Initialize express app
const app = express();

const corsOptions ={
   origin:'*', 
   credentials:true,            //access-control-allow-credentials:true
   optionSuccessStatus:200,
}

app.use(cors(corsOptions))

const postgres = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      port : 5432,
      user : 'postgres',
      password : 'simple',
      database : 'user'
    }
  }
  );

// Middleware to parse JSON request bodies
app.use(express.json());

// Route for user registration
// Route for user registration
app.post('/register', (req, res) => {
    // Extract user data from request body
    const { id, username, password, first_name, last_name, address, phone_number } = req.body;

    postgres('users')
        .where({ id }) // Check if the user with the provided ID already exists
        .first()
        .then(existingUser => {
            if (existingUser) {
                return res.status(409).json({ message: 'User already exists' });
            } else {
                // Use a transaction to ensure data consistency
                return postgres.transaction(trx => {
                    postgres('users')
                        .transacting(trx)
                        .insert({ id, first_name, last_name, phone_number, address })
                        .returning('*') // Return user data after insert
                        .then(userData => {
                            // Now that user data is inserted, insert 'admins' data
                            return postgres('admins')
                                .transacting(trx)
                                .insert({ id, username, password })
                                .then(() => userData); // Pass userData to the next then
                        })
                        .then(trx.commit)
                        .catch(trx.rollback);
                })
                .then(userData => {
                    return res.status(200).json({ message: 'User registered successfully', user: userData[0] });
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).json({ message: 'Internal Server Error' });
                });
            }
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: 'Internal Server Error' });
        });
});


app.post('/signin', (req, res) => {
    // Extract user data from request body
    const { username, password } = req.body;

    postgres('admins')
        .where({ username, password })
        .first()
        .then(user => {
            if (!user) {
                return res.status(401).json({ message: 'Invalid username or password' });
            } else {
                return postgres('users')
                      .where({id: user.id})
                      .first()
                      .then(
                        (userData => {
                            if (!userData) {
                                return res.status(404).json({ message: 'User data not found' });
                            }
                            return res.status(200).json(userData);
                        }
                        ))
            }
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ message: 'Internal Server Error' });
        });
});

app.put('/update/:id', (req, res) => {
    const id = req.params.id; // Get the user ID from the URL parameter
    const { username, password, first_name, last_name, address, phone_number } = req.body;

    // Start a transaction to ensure data consistency
    postgres.transaction(trx => {
        const updateUser = {
            id,
            first_name,
            last_name,
            address,
            phone_number,
        };

        // Update the user table
        postgres('users')
            .where({ id })
            .update(updateUser)
            .returning('*')
            .transacting(trx)
            .then(userData => {
                // If the username or password are provided, update the admin table as well
                if (username || password) {
                    const updateAdmin = {};
                    if (username) {
                        updateAdmin.username = username;
                    }
                    if (password) {
                        updateAdmin.password = password;
                    }

                    // Update the admin table
                    postgres('admins')
                        .where({ id })
                        .update(updateAdmin)
                        .transacting(trx)
                        .then(() => userData)
                        .catch(trx.rollback);
                    return userData;    
                } else {
                    return userData;
                }
            })
            .then(trx.commit)
            .catch(trx.rollback);
    })
    .then(userData => {
        return res.status(200).json({ message: 'User updated successfully', user: userData[0] });
    })
    .catch(error => {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    });
});


 // Use this after the variable declaration
// Start server
app.listen(3002, () => {
    console.log('Server started on port 3002');
});
