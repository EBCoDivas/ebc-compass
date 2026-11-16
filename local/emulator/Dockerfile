# AWS Emulator para macOS (Apple silicon). Basado en la guía oficial "Getting started with Docker".
# En equipos x86_64 cambia aws-emulator-aarch64.rpm por aws-emulator-x86_64.rpm.
# Nota: la URL usa "LTS/latest"; para reproducibilidad, fija la versión que registre docs/local-emulator-findings.md.
FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal
ADD https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-aarch64.rpm /tmp/aws-emulator.rpm
RUN rpm -i /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm \
    && mkdir -p /home/emulator && chown 1000 /home/emulator
USER 1000
ENV HOME=/home/emulator
EXPOSE 9297
ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0"]
