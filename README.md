# Oscar DevOps Lab 🚀

Proyecto DevOps desplegado en la nube con **Node.js**, **Express**, **Redis**, **Docker**, **Render** y **GitHub Actions**.

Incluye:
- contador global y por usuario
- health check
- métricas básicas
- dashboard visual
- despliegue automático

---

## Demo

Producción:
`https://mi-primer-proyecto-devops.onrender.com`

Endpoints:
- `/api/visits`
- `/health`
- `/metrics`
- `/version`

---

## Arquitectura

```text
Frontend (HTML estático)
        │
        ▼
Node.js + Express API
        │
        ▼
      Redis
Componentes
Frontend: HTML/CSS/JS estático servido desde public/
Backend: Express
Persistencia: Redis
Contenedor: Docker
Deploy: Render
CI/CD: GitHub Actions
Imagen: Docker Hub
Funcionalidades
1. Contador de visitas

El endpoint /api/visits registra:

visitas globales
visitas por IP
IP del cliente

Redis guarda:

visits:total
visits:user:<ip>
2. Health check

El endpoint /health valida:

estado del servicio
conectividad con Redis
uptime
timestamp
tiempo de respuesta
3. Métricas

El endpoint /metrics expone:

uptimeSeconds
totalRequests
totalErrors
successRate
4. Dashboard

La UI consume:

/api/visits
/health
/metrics

y muestra un panel básico tipo DevOps.

Stack tecnológico
Node.js
Express
Redis
Docker
Render
GitHub Actions
Docker Hub
HTML / CSS / JavaScript
Estructura del proyecto
mi-app/
├── .github/
├── public/
│   └── index.html
├── Dockerfile
├── package.json
├── package-lock.json
├── server.js
└── README.md
Ejecución local
1. Clonar repositorio
git clone <TU-REPO>
cd mi-app
2. Instalar dependencias
npm install
3. Levantar Redis local
docker run -d --name oscar-redis -p 6379:6379 redis
4. Configurar variable de entorno
export REDIS_URL="redis://localhost:6379"
5. Ejecutar aplicación
npm start

App local:
http://localhost:3000

Pruebas rápidas
Health
curl http://localhost:3000/health
Metrics
curl http://localhost:3000/metrics
Visits
curl http://localhost:3000/api/visits
Docker
Build
docker build -t oscar-devops-lab .
Run
docker run -p 3000:3000 -e REDIS_URL="redis://host.docker.internal:6379" oscar-devops-lab
CI/CD

El flujo actual considera:

control de versiones con Git/GitHub
despliegue automático en Render al hacer push
imagen Docker publicada en Docker Hub
Roadmap
 Backend con Express
 Redis para persistencia
 Dockerización
 Deploy en Render
 Health endpoint
 Metrics endpoint
 Dashboard visual
 Pipeline con validaciones
 Métricas en formato Prometheus
 Integración con Grafana / monitoreo avanzado
Autor

Oscar Terrones
Proyecto personal para practicar backend, contenedores, despliegue, observabilidad y flujo DevOps.
