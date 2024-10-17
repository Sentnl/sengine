## Wax Sengine




### Docker compose


`DB_USER=your_username DB_PASSWORD=your_secure_password DB_NAME=wax_monitoring DB_HOST=sengine-db docker-compose up --build`


### Only start sengine-app service

   `DB_USER=your_username DB_PASSWORD=your_secure_password DB_NAME=wax_monitoring DB_HOST=sengine-db docker-compose up --build --no-deps -d sengine-app`

```
--build: Rebuilds the image
--no-deps: Doesn't start linked services (so it won't touch the database)
-d: Runs in detached mode
--sengine-app: Specifies the service name to rebuild and restart
```
