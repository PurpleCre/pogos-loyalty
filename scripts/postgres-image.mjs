import {execFileSync} from 'node:child_process';
import {acceptanceImage,assertLocalDocker} from './postgres-acceptance-safety.mjs';
try{
  if(process.argv.length!==2)throw Error('No image or target arguments are accepted.');
  const endpoint=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
  assertLocalDocker(endpoint,process.env.DOCKER_HOST);
  execFileSync('docker',['pull',acceptanceImage],{stdio:'inherit',timeout:180000});
}catch(error){console.error(error.message);process.exitCode=1;}
