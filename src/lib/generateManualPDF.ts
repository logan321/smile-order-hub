import jsPDF from 'jspdf';

export function generateUserManualPDF() {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const m = 14;
  const cw = pw - m * 2;
  let y = 20;

  const title = (text: string) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 51, 84);
    doc.text(text, m, y);
    y += 3;
    doc.setDrawColor(34, 51, 84);
    doc.line(m, y, pw - m, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
  };

  const subtitle = (text: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(text, m, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
  };

  const body = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, cw);
    lines.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, m, y);
      y += 5;
    });
    y += 2;
  };

  const bullet = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, cw - 6);
    lines.forEach((line: string, i: number) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(i === 0 ? `• ${line}` : `  ${line}`, m, y);
      y += 5;
    });
  };

  const step = (num: number, text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${num}.`, m, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, cw - 10);
    lines.forEach((line: string, i: number) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, m + 8, y);
      y += 5;
    });
    y += 1;
  };

  const spacer = (s = 4) => { y += s; };

  // ═══════════════════════════════════════════
  // CAPA
  // ═══════════════════════════════════════════
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 51, 84);
  doc.text('Macro Master', pw / 2, 80, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Manual do Usuário', pw / 2, 95, { align: 'center' });

  doc.setFontSize(10);
  doc.text('Automação Gráfica Inteligente', pw / 2, 108, { align: 'center' });

  doc.setDrawColor(34, 51, 84);
  doc.setLineWidth(0.5);
  doc.line(60, 115, pw - 60, 115);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('Versão 1.0 — 2025', pw / 2, 125, { align: 'center' });

  // ═══════════════════════════════════════════
  // SUMÁRIO
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;
  doc.setTextColor(0, 0, 0);

  title('Sumário');
  const chapters = [
    '1. Primeiros Passos',
    '2. Painel (Dashboard)',
    '3. Clientes',
    '4. Pedidos',
    '5. Serviços',
    '6. Relatórios',
    '7. Configurações Gerais',
    '8. Simulador de Camisas (Editor)',
    '9. Configurações do Editor',
    '10. Rastreio de Pedidos',
    '11. Dúvidas Frequentes',
  ];
  chapters.forEach(ch => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(ch, m + 4, y);
    y += 7;
  });

  // ═══════════════════════════════════════════
  // 1. PRIMEIROS PASSOS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('1. Primeiros Passos');
  body('Bem-vindo ao Macro Master! Esta plataforma foi desenvolvida para facilitar a gestão completa do seu negócio de personalização gráfica, desde o atendimento ao cliente até a entrega do pedido.');
  spacer();
  subtitle('1.1 Criando sua conta');
  step(1, 'Acesse o link da plataforma fornecido pelo administrador.');
  step(2, 'Clique em "Criar conta" e preencha seu e-mail e senha.');
  step(3, 'Confirme seu e-mail clicando no link enviado para sua caixa de entrada.');
  step(4, 'Faça login e aproveite o período de teste gratuito de 7 dias.');
  spacer();
  subtitle('1.2 Período de Teste');
  body('Você tem 7 dias para explorar todas as funcionalidades gratuitamente. Após esse período, será necessário assinar o plano mensal para continuar utilizando a plataforma. O pagamento pode ser feito via Cartão, Boleto ou PIX.');

  // ═══════════════════════════════════════════
  // 2. DASHBOARD
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('2. Painel (Dashboard)');
  body('O painel é a tela inicial após o login. Ele apresenta um resumo visual do seu negócio:');
  spacer();
  bullet('Total de pedidos do mês');
  bullet('Receita do período');
  bullet('Pedidos pendentes de pagamento');
  bullet('Últimos pedidos cadastrados');
  spacer();
  body('Use o painel para ter uma visão rápida do andamento do seu negócio e identificar pendências.');

  // ═══════════════════════════════════════════
  // 3. CLIENTES
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('3. Clientes');
  body('A área de Clientes permite gerenciar toda a sua base de contatos.');
  spacer();
  subtitle('3.1 Cadastrar novo cliente');
  step(1, 'No menu lateral, clique em "Clientes".');
  step(2, 'Clique no botão "Novo Cliente".');
  step(3, 'Preencha o nome, telefone e e-mail.');
  step(4, 'Clique em "Salvar".');
  spacer();
  subtitle('3.2 Editar / Excluir');
  body('Para editar ou excluir um cliente, clique nos ícones de ação ao lado do nome do cliente na lista. Clientes com pedidos vinculados não podem ser excluídos.');

  // ═══════════════════════════════════════════
  // 4. PEDIDOS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('4. Pedidos');
  body('A seção de Pedidos é o coração da plataforma. Aqui você gerencia todo o fluxo de produção.');
  spacer();
  subtitle('4.1 Criar um pedido');
  step(1, 'Clique em "Pedidos" no menu lateral.');
  step(2, 'Clique em "Novo Pedido".');
  step(3, 'Selecione o cliente (ou cadastre um novo).');
  step(4, 'Adicione os serviços desejados, definindo quantidade para cada um.');
  step(5, 'Preencha os campos da ficha técnica (tecido, molde, etc.).');
  step(6, 'Faça upload dos layouts/artes do pedido.');
  step(7, 'Defina a data de entrega (opcional).');
  step(8, 'Clique em "Salvar".');
  spacer();
  subtitle('4.2 Acompanhar status');
  body('Cada pedido possui um status que reflete sua etapa de produção. Você pode personalizar as etapas em Configurações. Para mudar o status, clique no pedido e selecione a nova etapa.');
  spacer();
  subtitle('4.3 Marcar como pago');
  body('No detalhe do pedido, clique no ícone de pagamento para alternar entre "Pago" e "Pendente".');
  spacer();
  subtitle('4.4 Código de rastreio');
  body('Cada pedido recebe automaticamente um código de rastreio (ex: PED-00001). Compartilhe esse código com seu cliente para que ele acompanhe o status pela página pública de rastreio.');
  spacer();
  subtitle('4.5 Ficha técnica em PDF');
  body('Clique no ícone de impressão para gerar um PDF com todos os detalhes do pedido, incluindo layouts, ficha técnica e valores.');

  // ═══════════════════════════════════════════
  // 5. SERVIÇOS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('5. Serviços');
  body('Cadastre os serviços que sua empresa oferece com seus respectivos preços. Eles serão utilizados na criação dos pedidos.');
  spacer();
  subtitle('5.1 Cadastrar serviço');
  step(1, 'Acesse "Serviços" no menu lateral.');
  step(2, 'Clique em "Novo Serviço".');
  step(3, 'Preencha nome, descrição e preço.');
  step(4, 'Clique em "Salvar".');
  spacer();
  body('Os preços cadastrados aqui serão sugeridos automaticamente ao adicionar itens em um pedido, mas podem ser ajustados individualmente.');

  // ═══════════════════════════════════════════
  // 6. RELATÓRIOS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('6. Relatórios');
  body('A seção de Relatórios permite gerar documentos de cobrança para seus clientes.');
  spacer();
  subtitle('6.1 Gerar relatório');
  step(1, 'Acesse "Relatórios" no menu lateral.');
  step(2, 'Selecione um cliente.');
  step(3, 'O sistema exibirá todos os pedidos pendentes de pagamento daquele cliente.');
  step(4, 'Clique em "Gerar PDF" para baixar o documento de cobrança.');
  spacer();
  body('O PDF gerado inclui os dados da sua empresa, detalhamento dos serviços com quantidades e valores, e as instruções de pagamento configuradas em Configurações.');

  // ═══════════════════════════════════════════
  // 7. CONFIGURAÇÕES GERAIS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('7. Configurações Gerais');
  body('Personalize a plataforma de acordo com sua empresa.');
  spacer();
  subtitle('7.1 Dados da Empresa');
  body('Configure nome da empresa, CNPJ/CPF, telefone e e-mail. Esses dados aparecem nos relatórios e fichas técnicas.');
  spacer();
  subtitle('7.2 Pagamento / Cobrança');
  body('Defina as formas de pagamento aceitas, chave PIX, dados bancários e observações extras para os relatórios de cobrança.');
  spacer();
  subtitle('7.3 Etapas de Produção');
  body('Crie etapas personalizadas para o fluxo de produção (ex: Recebido, Em Produção, Pronto, Entregue). Essas etapas aparecerão como opções de status nos pedidos.');
  spacer();
  subtitle('7.4 Campos Personalizados');
  body('Adicione campos dinâmicos à ficha técnica dos pedidos (ex: Tipo de Tecido, Molde, Cor). Você pode criar campos de texto livre ou de seleção com opções predefinidas.');

  // ═══════════════════════════════════════════
  // 8. SIMULADOR DE CAMISAS
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('8. Simulador de Camisas (Editor)');
  body('O Simulador é uma ferramenta visual que permite aos seus clientes montar mockups de camisas personalizadas diretamente pelo celular ou computador.');
  spacer();
  subtitle('8.1 Como funciona');
  step(1, 'Seu cliente acessa o link público do editor (disponível em Config. Editor).');
  step(2, 'Seleciona o nicho (ex: Agro, Pesca, Esportivo).');
  step(3, 'Escolhe um modelo de camisa.');
  step(4, 'Personaliza adicionando estampas, textos e emblemas nas zonas disponíveis.');
  step(5, 'Alterna entre frente e costas para personalizar os dois lados.');
  step(6, 'Ao finalizar, preenche nome e telefone e envia o orçamento via WhatsApp.');
  spacer();
  subtitle('8.2 Recursos do editor');
  bullet('Estampas: Imagens que podem ser posicionadas e redimensionadas.');
  bullet('Textos: Textos editáveis com opções de cor, sombra e contorno.');
  bullet('Estilos de texto: Templates visuais enviados como referência ao designer.');
  bullet('Emblemas: Itens posicionados em zonas específicas marcadas como "Apenas Peixe".');
  bullet('Frente e Costas: Visualização e edição independente de cada lado.');
  spacer();
  subtitle('8.3 Envio do orçamento');
  body('Ao clicar em "Enviar Orçamento", o sistema gera automaticamente uma mensagem no WhatsApp contendo: nome do cliente, modelo da camisa, itens utilizados (com nomes), links para download dos mockups e arquivos originais.');

  // ═══════════════════════════════════════════
  // 9. CONFIG. EDITOR
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('9. Configurações do Editor');
  body('Nesta seção você gerencia todos os assets do simulador de camisas.');
  spacer();
  subtitle('9.1 Nichos');
  body('Crie categorias para organizar seus modelos (ex: Agro, Pesca, Esportivo). Cada nicho pode ter um ícone, rótulo personalizado para emblemas e uma imagem de capa.');
  spacer();
  subtitle('9.2 Templates de Camisa');
  body('Cadastre os modelos de camisa com imagens de frente e costas. Vincule cada template a um nicho e defina as zonas de edição (áreas onde o cliente poderá posicionar itens).');
  spacer();
  subtitle('9.3 Zonas de Edição');
  body('As zonas definem onde os elementos podem ser posicionados na camisa. Cada zona pode ser marcada como:');
  bullet('"Compartilhada" (frente e costas): aparece em ambos os lados.');
  bullet('"Apenas Peixe": exclusiva para emblemas, oculta para o usuário final.');
  spacer();
  subtitle('9.4 Estampas');
  body('Cadastre as estampas disponíveis para os clientes. Cada estampa pode ter imagens diferentes para frente e costas, e deve ser vinculada a um nicho.');
  spacer();
  subtitle('9.5 Emblemas');
  body('Cadastre os emblemas (peixes, logos, etc.) que serão posicionados nas zonas marcadas como "Apenas Peixe". Vincule cada emblema a um nicho e defina a zona-alvo.');
  spacer();
  subtitle('9.6 Estilos de Texto');
  body('Cadastre imagens de referência de estilos tipográficos. Esses estilos são enviados como referência visual na mensagem de orçamento.');
  spacer();
  subtitle('9.7 WhatsApp');
  body('Configure o número de WhatsApp que receberá os orçamentos dos clientes.');
  spacer();
  subtitle('9.8 Link Público');
  body('Copie o link público do seu editor personalizado para compartilhar com seus clientes. O link segue o formato: /editor/seu-user-id');

  // ═══════════════════════════════════════════
  // 10. RASTREIO
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('10. Rastreio de Pedidos');
  body('A página de rastreio é pública e permite que seus clientes acompanhem o status do pedido sem precisar de login.');
  spacer();
  subtitle('10.1 Como usar');
  step(1, 'Compartilhe o código de rastreio com seu cliente (ex: PED-00001).');
  step(2, 'O cliente acessa a página de rastreio e digita o código.');
  step(3, 'O sistema exibe o status atual, detalhes do pedido e layouts.');
  spacer();
  body('A página de rastreio também permite gerar o PDF da ficha técnica do pedido.');

  // ═══════════════════════════════════════════
  // 11. DÚVIDAS FREQUENTES
  // ═══════════════════════════════════════════
  doc.addPage();
  y = 20;

  title('11. Dúvidas Frequentes');
  spacer();
  subtitle('Como altero minha senha?');
  body('Atualmente, utilize a opção "Esqueci minha senha" na tela de login para receber um link de redefinição por e-mail.');
  spacer();
  subtitle('Posso ter mais de um usuário na mesma conta?');
  body('Cada assinatura é individual. Cada usuário precisa criar sua própria conta.');
  spacer();
  subtitle('Como cancelo minha assinatura?');
  body('Entre em contato com o administrador via WhatsApp para solicitar o cancelamento.');
  spacer();
  subtitle('Meu período de teste acabou, e agora?');
  body('Ao expirar o teste, você será redirecionado para a tela de assinatura. Escolha entre pagar com Cartão/Boleto ou PIX via WhatsApp para reativar seu acesso.');
  spacer();
  subtitle('Os dados dos meus clientes são seguros?');
  body('Sim! Cada usuário só tem acesso aos seus próprios dados. Todas as informações são protegidas com políticas de segurança a nível de banco de dados.');
  spacer();
  subtitle('Preciso de ajuda, como entro em contato?');
  body('Utilize o botão de WhatsApp na tela de assinatura ou entre em contato pelo número fornecido pelo administrador.');

  // ═══════════════════════════════════════════
  // RODAPÉ FINAL
  // ═══════════════════════════════════════════
  spacer(10);
  doc.setDrawColor(34, 51, 84);
  doc.line(m, y, pw - m, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Macro Master — Automação Gráfica Inteligente', pw / 2, y, { align: 'center' });
  y += 5;
  doc.text('Este manual é propriedade do administrador e destinado aos seus clientes.', pw / 2, y, { align: 'center' });

  doc.save('Manual_Macro_Master.pdf');
}
