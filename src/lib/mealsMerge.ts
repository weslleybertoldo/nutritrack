import { Meal } from "@/types";

/**
 * Funde refeições do mesmo dia+tipo numa só linha de exibição.
 * Rede de segurança do Diário: quando o banco tem duas linhas do mesmo tipo
 * (histórico anterior ao índice único), a tela mostrava só a primeira e o
 * total do dia somava as duas — os alimentos "sumiam". Aqui a mais antiga
 * (primeira na ordem recebida) vira a principal e recebe os itens das outras.
 */
export function mergeDuplicateMeals<T extends Meal>(meals: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const meal of meals) {
    const key = `${meal.data}|${meal.tipo}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...meal, items: [...(meal.items || [])] });
      continue;
    }
    byKey.set(key, {
      ...current,
      nome_personalizado: current.nome_personalizado || meal.nome_personalizado,
      items: [...(current.items || []), ...(meal.items || [])],
    });
  }
  return [...byKey.values()];
}

/**
 * Reconcilia a resposta do servidor com o estado local.
 * A busca das refeições do dia pode responder DEPOIS de o usuário criar uma
 * refeição/item (resposta atrasada, retry do 401 transitório). Sobrescrever o
 * estado com essa resposta apagava da tela o que acabou de ser criado — o card
 * voltava a "Vazio" e o segundo toque gerava uma refeição duplicada no banco.
 * Regras:
 *  - refeições/itens criados localmente nesta sessão que o servidor ainda não
 *    devolveu são mantidos;
 *  - refeições/itens removidos localmente que a resposta atrasada ainda traz
 *    são descartados.
 */
export function reconcileMeals(
  server: Meal[],
  local: Meal[],
  date: string,
  locallyCreated: Set<string>,
  locallyDeleted: Set<string>,
): Meal[] {
  const serverIds = new Set(server.map(m => m.id));
  const result: Meal[] = [];

  for (const serverMeal of server) {
    if (locallyDeleted.has(serverMeal.id)) continue;
    const localMeal = local.find(m => m.id === serverMeal.id);
    const serverItems = (serverMeal.items || []).filter(i => !locallyDeleted.has(i.id));
    if (!localMeal) {
      result.push({ ...serverMeal, items: serverItems });
      continue;
    }
    const serverItemIds = new Set(serverItems.map(i => i.id));
    const extraLocalItems = (localMeal.items || []).filter(
      i => !serverItemIds.has(i.id) && locallyCreated.has(i.id),
    );
    result.push({ ...serverMeal, items: [...serverItems, ...extraLocalItems] });
  }

  for (const localMeal of local) {
    if (localMeal.data !== date) continue;
    if (serverIds.has(localMeal.id) || locallyDeleted.has(localMeal.id)) continue;
    if (locallyCreated.has(localMeal.id)) result.push(localMeal);
  }

  return result;
}
