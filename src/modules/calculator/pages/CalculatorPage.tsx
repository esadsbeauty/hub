import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Copy, Calculator, Heart } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const questions = [
  {
    title: "Quanto você gostaria de faturar por mês?",
    helper: "Pense no total que você gostaria de receber com seus atendimentos em um mês.",
    label: "Minha meta mensal",
    placeholder: "Ex.: 10000",
  },
  {
    title: "Quanto você costuma faturar por mês hoje?",
    helper: "Pode ser uma média aproximada. Não precisa saber o valor exato.",
    label: "O que recebo hoje por mês",
    placeholder: "Ex.: 4000",
  },
  {
    title: "Quanto uma cliente costuma gastar com você?",
    helper: "Pense em quanto recebe, em média, por atendimento. Por exemplo, R$ 500.",
    label: "Valor médio de um atendimento",
    placeholder: "Ex.: 500",
  },
];

export function CalculatorPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [outOfTen, setOutOfTen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const values = answers.map((value) => Number(value));
  const validMoney = (index: number) => Number.isFinite(values[index]) && values[index] > 0 && values[index] <= 100000000;
  const currentValid = step === 3 ? outOfTen !== null : step < 3 && validMoney(step);
  const gap = Math.max(0, values[0] - values[1]);
  const extraAppointments = Math.ceil(gap / (values[2] || 1));
  const interested = outOfTen ? Math.ceil(extraAppointments * 10 / outOfTen) : 0;
  const reached = gap === 0;
  const summary = [
    "Minha simulação ESADS Beauty",
    "Meta mensal: " + money(values[0]),
    "Faturamento atual médio: " + money(values[1]),
    "Valor por atendimento: " + money(values[2]),
    "De cada 10 interessados, agendam: " + outOfTen,
    "Falta faturar por mês: " + money(gap),
    "Atendimentos adicionais estimados: " + extraAppointments,
    "Pessoas interessadas necessárias (estimativa): " + interested,
  ].join("\n");

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      const element = document.createElement("textarea");
      element.value = summary;
      document.body.appendChild(element);
      element.select();
      document.execCommand("copy");
      element.remove();
      setCopied(true);
    }
  }

  function reset() {
    setStep(0);
    setAnswers(["", "", ""]);
    setOutOfTen(null);
    setCopied(false);
  }

  return (
    <div className="min-h-[70vh] bg-[#fbfaf8] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e6d9c6] bg-white px-4 py-2 text-xs font-bold tracking-wide text-[#785934]">
            <Heart size={15} aria-hidden="true" /> UMA FERRAMENTA GRATUITA DA ESADS BEAUTY
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#1b211d] sm:text-4xl">Calculadora de metas para profissionais da estética</h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[#646a64]">
            Descubra quantos atendimentos você pode precisar fazer para alcançar o faturamento que deseja.
          </p>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-[#e9e5de] bg-white shadow-[0_18px_60px_rgba(30,35,29,.07)]" aria-label="Calculadora de metas">
          <div className="border-b border-[#f0ece6] px-6 py-5 sm:px-9">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#253d31]"><Calculator size={18} aria-hidden="true" /> Sua simulação</span>
              <span className="text-sm text-[#777b75]">{step < 4 ? "Pergunta " + (step + 1) + " de 4" : "Resultado"}</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
              {[0, 1, 2, 3].map((number) => (
                <div key={number} className={"h-1.5 rounded-full " + (number <= step ? "bg-[#47775d]" : "bg-[#eeeae4]")} />
              ))}
            </div>
          </div>

          <div className="px-6 py-8 sm:px-9 sm:py-10">
            {step < 3 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold leading-snug text-[#1d2922]">{questions[step].title}</h2>
                  <p className="mt-3 text-base leading-relaxed text-[#626963]">{questions[step].helper}</p>
                </div>
                <div>
                  <label htmlFor="calculator-amount" className="mb-2 block text-sm font-semibold text-[#334139]">{questions[step].label}</label>
                  <div className="flex overflow-hidden rounded-2xl border border-[#dcded8] focus-within:border-[#47775d] focus-within:ring-2 focus-within:ring-[#47775d]/20">
                    <span className="flex items-center bg-[#f4f5f1] px-4 text-lg font-semibold text-[#637065]">R$</span>
                    <input
                      id="calculator-amount"
                      type="number"
                      min="1"
                      max="100000000"
                      step="any"
                      inputMode="decimal"
                      value={answers[step]}
                      placeholder={questions[step].placeholder}
                      onChange={(event) => setAnswers((previous) => previous.map((value, index) => index === step ? event.target.value : value))}
                      onKeyDown={(event) => { if (event.key === "Enter" && currentValid) setStep((previous) => previous + 1); }}
                      className="h-16 min-w-0 w-full bg-white px-4 text-xl font-semibold text-[#1d2922] outline-none placeholder:text-[#b0b6af]"
                    />
                  </div>
                </div>
              </div>
            ) : step === 3 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold leading-snug text-[#1d2922]">De cada 10 pessoas que perguntam sobre seus serviços, quantas acabam agendando?</h2>
                  <p className="mt-3 text-base leading-relaxed text-[#626963]">Não sabe ao certo? Escolha o número que mais se aproxima da sua realidade.</p>
                </div>
                <div className="grid grid-cols-2 gap-3" role="group" aria-label="Quantidade de pessoas que agendam">
                  {[1, 3, 5, 7].map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={outOfTen === count}
                      onClick={() => setOutOfTen(count)}
                      className={"min-h-20 rounded-2xl border px-3 py-4 text-left transition-colors " + (outOfTen === count ? "border-[#47775d] bg-[#ecf5ef] text-[#214d34] ring-2 ring-[#47775d]/15" : "border-[#e5e4de] bg-white text-[#26332a] hover:bg-[#f6f7f3]")}
                    >
                      <span className="block text-xl font-bold">{count} {count === 1 ? "pessoa" : "pessoas"}</span>
                      <span className="text-sm">em cada 10</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6" aria-live="polite">
                <div>
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#e7f2e9] text-[#397354]"><Check size={25} aria-hidden="true" /></div>
                  <h2 className="text-2xl font-bold text-[#1d2922]">{reached ? "Você já alcançou sua meta informada!" : "Veja o que seus números mostram"}</h2>
                  <p className="mt-2 text-base text-[#626963]">Esta é uma simulação simples baseada nas suas respostas.</p>
                </div>
                <div className="rounded-2xl bg-[#f3f6f1] p-5">
                  <p className="text-sm text-[#526154]">Para alcançar sua meta mensal, falta faturar</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[#1d4732]">{money(gap)}</p>
                </div>
                {!reached && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#e5e9e2] p-5">
                      <p className="text-sm text-[#647064]">Atendimentos a mais por mês</p>
                      <p className="mt-2 text-4xl font-bold text-[#213b2b]">{extraAppointments}</p>
                    </div>
                    <div className="rounded-2xl border border-[#e5e9e2] p-5">
                      <p className="text-sm text-[#647064]">Pessoas interessadas que precisariam entrar em contato por mês</p>
                      <p className="mt-2 text-4xl font-bold text-[#213b2b]">{interested}</p>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-[#ecdfc7] bg-[#fffbf3] p-5 text-sm leading-relaxed text-[#67543a]">
                  <strong>Importante:</strong> os números são estimativas, não uma promessa de resultado. Consideramos que cada agendamento vire um atendimento pago, com o valor médio que você informou. Na prática, cancelamentos e outras situações podem mudar esses valores.
                </div>
                <p className="text-base leading-relaxed text-[#4b5750]">
                  {reached ? "Parabéns! Você pode usar esta ferramenta novamente para planejar uma nova meta." : "Não é só sobre receber mais mensagens: aproveitar melhor cada conversa também faz diferença."}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={copySummary} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#214d34] px-4 py-3 font-semibold text-white hover:bg-[#183c28]"><Copy size={18} /> {copied ? "Resultado copiado!" : "Copiar meu resultado"}</button>
                  <button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] px-4 py-3 font-semibold text-[#214d34] hover:bg-[#f4f7f2]"><RotateCcw size={18} /> Fazer outra simulação</button>
                </div>
              </div>
            )}
          </div>

          {step < 4 && (
            <div className="flex items-center justify-between border-t border-[#f0ece6] px-6 py-5 sm:px-9">
              <button type="button" disabled={step === 0} onClick={() => setStep((previous) => Math.max(0, previous - 1))} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-[#5e695f] disabled:opacity-30"><ArrowLeft size={18} /> Voltar</button>
              <button type="button" disabled={!currentValid} onClick={() => setStep((previous) => Math.min(4, previous + 1))} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#214d34] px-5 font-semibold text-white hover:bg-[#183c28] disabled:cursor-not-allowed disabled:opacity-40">{step === 3 ? "Ver meu resultado" : "Continuar"} <ArrowRight size={18} /></button>
            </div>
          )}
        </section>
        <p className="mt-5 text-center text-sm leading-relaxed text-[#8a8d86]">Gratuito e sem cadastro. Seus números são calculados aqui no navegador e não são enviados para o ESADS Beauty.</p>
      </div>
    </div>
  );
}
