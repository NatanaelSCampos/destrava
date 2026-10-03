# Onboarding pedagógico v1

## Reuso e fluxo

O curso ativo continua no cookie `destrava-active-course` e vem do `CourseRegistry`. O `StudyProvider` guarda o percurso em `user_course_state` por `(user_id, course_id)` e projeta o perfil em `user_course_profiles`. O novo percurso substitui o formulário livre da visão geral; novos cursos começam com `onboarded=false`. Estados legados que já possuem um perfil são normalizados como matrículas existentes, sem tela obrigatória. A tela Configurações → Meu aprendizado permite personalizar depois.

Fluxo: idioma → nível percebido → objetivo → contextos do curso quando disponíveis → uma ou duas habilidades em ordem → tempo de sessão → resumo calculado com o `SessionPlanner` → diagnóstico do curso, recomendado ou opcional → produto. Cada escolha é salva no estado do curso antes de avançar. O nível percebido não altera o nível CEFR do curso.

## Contratos e consumidores

`LearningPreferences` valida objetivo, contextos, prioridades, pesos derivados e duração (5, 15, 30 ou 45 minutos). `InitialLearningAssessment` é representado por `selfReportedLevel` e pelo diagnóstico adaptativo existente. `CoursePackage` pode declarar `supportedGoals`, `contexts` e `skillFloors`; missões, role-plays e atividades podem declarar `goals` e `contexts`. O compilador projeta esses dados para o runtime.

O motor de recomendação mantém revisão vencida e dificuldades acima do currículo. A primeira atividade curricular pendente recebe prioridade antes dos bônus limitados de habilidade, objetivo e contexto. O plano de sessão usa a duração escolhida e esse ranking. Missões são ordenadas por contexto exato, depois objetivo, depois conteúdo geral. Conteúdo sem afinidade permanece disponível. Tutor e conversa recebem somente objetivo e rótulos dos contextos escolhidos, como dicas opcionais.

## Pergunta → campo → consumidor → efeito observável

| Pergunta | Campo | Consumidor | Efeito observável |
| --- | --- | --- | --- |
| Idioma | cookie do curso ativo + `course_id` | CourseRegistry e StudyProvider | Troca conteúdo e recupera plano/progresso isolado. |
| Quanto já sabe? | `selfReportedLevel` | Regra do diagnóstico | Altera recomendação de começar pelo diagnóstico; não define CEFR. |
| Onde usar o idioma? | `learningPreferences.goal` | Recomendação, missões e tutor | Ordena missões e atividades com objetivo compatível. |
| Em quais situações? | `learningPreferences.contexts` | Afinidade de conteúdo | Situação correspondente aparece primeiro, com fallback para objetivo/geral. |
| O que mais importa? | `skillPriorities` e `skillWeights` | Recomendação e SessionPlanner | Atividades opcionais da habilidade ganham espaço na sessão. |
| Quanto tempo? | `preferredSessionMinutes` | SessionPlanner e aula | Duração padrão e número de atividades se ajustam. |

## Persistência, segurança e limites

A migração `20261003000700_pedagogical_onboarding.sql` estende `user_course_profiles` sem apagar dados, preservando as políticas RLS de dono da linha e de MFA. O estado completo e os passos ficam em `user_course_state`. Edição de preferências altera somente `profile`, sem resetar progresso, erros, revisão, histórico ou avaliações. Eventos registrados: `onboarding_started`, `onboarding_step_completed`, `onboarding_completed`, `diagnostic_started`, `diagnostic_skipped`, `learning_preferences_updated`.

O curso inglês atual é curto e possui apenas a missão de conhecer um colega; objetivos sem conteúdo específico usam o currículo geral. A qualidade pedagógica das sugestões, a reação de alunos reais ao percurso e a decisão de fazer o diagnóstico exigem avaliação humana após a publicação.
