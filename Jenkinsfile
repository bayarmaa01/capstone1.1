pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'bayarmaa'
        DOCKER_HUB_PASS = credentials('dockerhub-token')
        APP_NAME = 'automated-attendance'
    }

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/bayarmaa01/capstone1.1.git'
            }
        }

        stage('Build Docker Images') {
            steps {
                sh 'docker build -t $DOCKER_HUB_USER/$APP_NAME-backend ./backend'
                sh 'docker build -t $DOCKER_HUB_USER/$APP_NAME-frontend ./frontend'
            }
        }

        stage('Push to DockerHub') {
            steps {
                sh 'echo $DOCKER_HUB_PASS | docker login -u $DOCKER_HUB_USER --password-stdin'
                sh 'docker push $DOCKER_HUB_USER/$APP_NAME-backend'
                sh 'docker push $DOCKER_HUB_USER/$APP_NAME-frontend'
            }
        }

        stage('Deploy on Server') {
            steps {
                sh '''
                docker pull $DOCKER_HUB_USER/$APP_NAME-backend
                docker pull $DOCKER_HUB_USER/$APP_NAME-frontend
                docker compose down || true
                docker compose up -d
                '''
            }
        }
    }
}
