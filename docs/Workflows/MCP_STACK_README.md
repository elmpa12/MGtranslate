## 🧠 Serena + mem0 – Memória de Longo Prazo

**O que é:**  
Camada de **memória de longo prazo** para agentes. A dupla Serena + mem0 funciona como:

- **mem0**: armazenamento de memórias vetorizadas (fatos, decisões, contexto de projetos).
    
- **Serena**: a “orquestradora de memória”: decide o que vale a pena guardar, como recuperar e como injetar de volta no contexto dos agentes.
    

**Pra que usar:**

- Lembrar de:
    
    - Estrutura do projeto (pastas, serviços, MCPs, etc).
        
    - Decisões arquiteturais (“esse server roda só no server01”, “Chroma é o vetor DB padrão”).
        
    - Preferências tuas (estilo, tecnologias, constraints).
        
- Fazer o agente parecer um “dev que já trabalha no projeto há semanas”, não um turista de uma rodada só.
    

**Na prática:**

- Qualquer agente (UI, Meet Bot, Integration, Orchestrator) pode:
    
    - **Gravar** decisões importantes em Serena/mem0.
        
    - **Consultar** antes de propor algo (ex: “já temos um serviço similar?”).
        

---

## 🧬 Chroma MCP – Vetor DB via Docker

**O que é:**  
Um **Vector Database** (Chroma) exposto como MCP:

- Container: `mcp/chroma`
    
- Operações típicas:
    
    - `create_collection`
        
    - `add_documents`
        
    - `query_documents`
        
    - `update_documents`
        
    - `delete_documents`
        

**Pra que usar (RAG):**

- Indexar:
    
    - Código fonte (ou partes relevantes).
        
    - Docs de arquitetura.
        
    - Logs resumidos.
        
    - Notas técnicas, ADRs (Architecture Decision Records).
        
- Permitir RAG de verdade:
    
    - “Qual é o formato do evento `TRANSLATED_AUDIO`?”
        
    - “Como está definido o contrato Orchestrator ↔ Integration Agent?”
        
    - “O que já decidimos sobre provedores de STT/TTS?”
        

**Na prática:**

- Serena ou qualquer agente pode:
    
    - Mandar indexar arquivos (via Filesystem MCP + Chroma).
        
    - Fazer `query` por similaridade quando precisa responder baseado em conhecimento já escrito.
        

---

## 🔁 SequentialThinking MCP – Orquestração de raciocínio

**O que é:**  
Um MCP especializado em **quebrar problemas em passos** e orquestrar **cadeias de raciocínio**:

- Container: `mcp/sequentialthinking`
    
- Funções típicas:
    
    - decompor tarefa em sub-passos.
        
    - executar raciocínios passo-a-passo (tipo chain-of-thought estruturado).
        
    - coordenar “mini-agentes” internos em sequência.
        

**Pra que usar:**

- Quando a tarefa é complexa demais pra uma resposta de uma tacada só:
    
    - “Definir API completa entre Orchestrator, Meet Bot e Integration.”
        
    - “Desenhar pipeline de deploy do sistema inteiro.”
        
- Para:
    
    - montar **checklists de implementação**,
        
    - garantir que não esqueceu nada crítico (auth, retries, logging mínimo),
        
    - gerar planos antes de mexer em arquivo/código.
        

**Na prática:**

- O Orchestrator Agent pode chamar SequentialThinking para:
    
    - gerar plano de alto nível,
        
    - depois distribuir as subtarefas para UI / Meet Bot / Integration Agents.
        

---

## 🧠 Context7 MCP – Biblioteca de raciocínio avançado

**O que é:**  
Um MCP de **raciocínio avançado / libs cognitivas**, exposto assim:

- Container: `mcp/context7`
    
- Requer: `MCP_TRANSPORT=stdio`
    
- Operações:
    
    - `resolve-library-id`
        
    - `get-library-docs`
        
- Roda **exclusivamente no server01**.
    

Na prática, ele é um **repositório de “bibliotecas de contexto”** (patterns, snippets, docs) que os agentes podem carregar de forma dinâmica.

**Pra que usar:**

- Injetar “pacotes de conhecimento” prontos:
    
    - ex.: _“library de boas práticas de RAG”_
        
    - ex.: _“library de arquitetura de microserviços Python+gRPC”_
        
- Permitir que o agente:
    
    - resolva um `library-id` e carregue docs/templates específicos como contexto antes de responder.
        

**Na prática:**

- Antes de projetar algo grande (tipo todo o pipeline de tradução), o Orchestrator pode:
    
    - chamar `resolve-library-id("rag-architecture")`
        
    - pegar docs com `get-library-docs`
        
    - usar isso para embasar as decisões de arquitetura.
        

---

## 📁 Filesystem MCP – Acesso ao FS do lab

**O que é:**

- Tipo: `stdio`
    
- Comando: `server-filesystem` (ou equivalente)
    
- Permite:
    
    - ler arquivos locais,
        
    - escrever/editar,
        
    - criar, listar, apagar,
        
    - servir de base para indexação no RAG.
        

**Pra que usar:**

- É o **gateway** entre o mundo “agente” e o teu código real no disco:
    
    - Ler `orchestrator_service.py`,
        
    - Editar `docker-compose.yml`,
        
    - Criar `docs/architecture/meet-bot.md`,
        
    - Preparar arquivos pra serem indexados em Chroma.
        
- Em conjunto com Serena + Chroma:
    
    - Pega arquivos via Filesystem,
        
    - Resume/indexa em Chroma,
        
    - Guarda decisões-chave em Serena/mem0.
        

---

## Como tudo se encaixa (visão de uso pelos agentes)

Imagina o fluxo ideal de trabalho dos teus agentes:

1. **Orchestrator Agent**
    
    - Recebe uma tarefa grande (ex.: “definir APIs dos 4 serviços”).
        
    - Usa **SequentialThinking** pra quebrar em passos.
        
    - Usa **Context7** pra carregar padrões de arquitetura/RAG.
        
2. **Filesystem MCP**
    
    - UI/Meet Bot/Integration Agents leem/escrevem arquivos do projeto usando o Filesystem.
        
    - Criam/ajustam código, configs, docs.
        
3. **Chroma MCP**
    
    - Orchestrator/Serena indexam:
        
        - docs de arquitetura,
            
        - especificações de API,
            
        - resumos do repositório.
            
    - Outros agentes consultam Chroma quando precisam de contexto histórico.
        
4. **Serena + mem0**
    
    - Guardam:
        
        - decisões arquiteturais,
            
        - convenções (“sempre usar Google STT no MVP”),
            
        - histórico de problemas e soluções.
            
    - Ao longo dos dias, os agentes ficam “experts” no teu stack.
        

Resultado:  
Teus agentes não são só GPT solto escrevendo arquivo; eles viram uma **equipe de devs com memória, repositório semântico e capacidade de planejar**.

Esses MCPs são, basicamente, o kit de **cérebro + memória + acesso ao mundo real** pra essa equipe.


