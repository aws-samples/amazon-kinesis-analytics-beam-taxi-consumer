export stackname='streaming-analytics-workshop-beam'

while getopts s: flag
do
    case "${flag}" in
        s ) stackname=${OPTARG};;
    esac
done

pip3 install --upgrade --user awscli

sudo yum install -y jq

sudo wget https://repos.fedorapeople.org/repos/dchen/apache-maven/epel-apache-maven.repo -O /etc/yum.repos.d/epel-apache-maven.repo
sudo sed -i s/\$releasever/6/g /etc/yum.repos.d/epel-apache-maven.repo
sudo yum install -y apache-maven

sudo rpm --import https://yum.corretto.aws/corretto.key 
sudo curl -L -o /etc/yum.repos.d/corretto.repo https://yum.corretto.aws/corretto.repo
sudo yum install -y java-11-amazon-corretto-devel
alias java="/usr/lib/jvm/java-11-amazon-corretto/bin/java"

export tag_value_arn=`aws cloudformation describe-stacks \
     --stack-name $stackname | jq -c '.Stacks[].Outputs[] | select(.OutputKey | contains("Tag")).OutputValue' --raw-output`
export tag_value=`echo ${tag_value_arn##*:}`
export instance_profile_name=`aws cloudformation describe-stacks \
    --stack-name $stackname | jq -c '.Stacks[].Outputs[] | select(.OutputKey | contains("ProfileName")).OutputValue' --raw-output`
export instance_id=`aws ec2 describe-instances \
 	--filters "Name=tag-value, Values=$tag_value" \
 	--query "Reservations[].Instances[].InstanceId" --output text`

aws ec2 associate-iam-instance-profile --iam-instance-profile Name=$instance_profile_name --instance-id $instance_id
