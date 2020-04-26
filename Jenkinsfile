def ansibleHosts = 'staging'

if (env.BRANCH_NAME == 'master') {
	ansibleHosts = 'production'
}

pipeline {
	agent none

	stages {
		stage('Build') {
			agent {
				docker {
					image 'node:12.16.1-buster'
				}
			}
			environment {
				npm_config_cache = "${env.JENKINS_HOME}/.npm"
				CACHE_DIR = "${env.JENKINS_HOME}/three-words-cache"
			}
			steps {
				sh 'npm run npm-ci-cached'
				sh 'rm -rf web/dist'
				sh 'npm run build-web'
			}

			post {
				always {
					archiveArtifacts artifacts: 'web/dist/**/*', onlyIfSuccessful: true
				}
			}
		}

		stage('Deploy') {
			agent {
				docker {
					image 'debian-ansible:3'
					args '-v /etc/passwd:/etc/passwd:ro'
				}
			}

			when {
				allOf {
					anyOf {
						branch 'master'
						branch 'develop'
					}
					expression {
						currentBuild.result == null || currentBuild.result == 'SUCCESS'
					}
				}

			}

			environment {
				HOME = "${env.WORKSPACE}/.jenkinsDeployHome"
				ANSIBLE_HOST_KEY_CHECKING = 'False'
			}

			steps {
				configFileProvider([configFile(fileId: 'ansible_hosts', variable: 'myAnsibleHosts')]) {
					withCredentials([sshUserPrivateKey(credentialsId: "jenkins-key", keyFileVariable: 'sshFile')]) {
						sh "ansible-playbook \
							-i ${myAnsibleHosts} \
							--key-file ${sshFile} \
							--extra-vars 'variable_hosts=${ansibleHosts}' \
							build-scripts/ansible/deploy.yml"
					}
				}
			}
		}
	}
}
