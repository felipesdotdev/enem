# Publicação do Caderno ENEM

A VPS executa Node.js 22.15 ou superior. O Caddy termina TLS para `enem.felipes.dev` e encaminha as requisições ao serviço local na porta 3764.

## Instalação inicial

Execute na VPS com uma cópia do repositório. Use uma conta de operação com acesso a `sudo`.

```sh
sudo useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin caderno-enem
sudo install -d -m 0755 -o "$(id -un)" -g "$(id -gn)" /srv/caderno-enem /srv/caderno-enem/releases
sudo install -m 0644 deploy/caderno-enem.service /etc/systemd/system/caderno-enem.service
sudo systemctl daemon-reload
sudo systemctl enable caderno-enem.service
sh deploy/release.sh
```

Configure o registro A de `enem.felipes.dev` com o IPv4 da VPS. Acrescente o bloco em `deploy/Caddyfile` ao arquivo de configuração do Caddy. Valide a configuração antes de recarregar o serviço.

## Atualizações

Na VPS, execute `sh deploy/release.sh <commit>` com o hash publicado. Sem argumento, o script usa o `main` remoto. Ele prepara uma versão em diretório separado e testa o endpoint de saúde antes de considerar a atualização concluída. Se a verificação falhar, restaura a versão anterior.

O SQLite usa `/var/lib/caderno-enem/caderno.sqlite`. Esse diretório persiste entre atualizações. Consulte os logs com `sudo journalctl -u caderno-enem.service`.
