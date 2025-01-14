import { User } from '@prisma/client';
import { SlashCommandInteraction } from 'mahoji/dist/lib/structures/SlashCommandInteraction';
import { Bank } from 'oldschooljs';
import { table } from 'table';

import { SlayerRewardsShop } from '../../../lib/slayer/slayerUnlocks';
import { removeFromArr, stringMatches } from '../../../lib/util';
import { logError } from '../../../lib/util/logError';
import { allItemsOwned, handleMahojiConfirmation, mahojiUserSettingsUpdate } from '../../mahojiSettings';

const slayerPurchaseError =
	'An error occurred trying to make this purchase. Please try again or contact #help-and-support if the issue persists.';

export async function slayerShopBuyCommand({
	mahojiUser,
	buyable,
	quantity,
	disable,
	interaction
}: {
	mahojiUser: User;
	buyable: string;
	quantity?: number;
	disable?: boolean;
	interaction?: SlashCommandInteraction;
}) {
	const klasaUser = await globalClient.fetchUser(mahojiUser.id);
	const buyableObj = SlayerRewardsShop.find(
		reward => stringMatches(reward.name, buyable) || reward.aliases?.some(alias => stringMatches(alias, buyable))
	);
	if (!buyableObj) {
		return `Cannot find Slayer buyable with the name ${buyable}`;
	}
	if (buyableObj.item) {
		// Handle buying items with slayer points:
		if (buyableObj.haveOne && allItemsOwned(klasaUser).has(buyableObj.item)) {
			return `You already own a ${buyableObj.name}`;
		}
		const qty = buyableObj.haveOne ? 1 : quantity ?? 1;
		const cost = qty * buyableObj.slayerPointCost;
		if (mahojiUser.slayer_points >= cost) {
			try {
				await mahojiUserSettingsUpdate(mahojiUser.id, { slayer_points: { decrement: cost } });
				await klasaUser.addItemsToBank({ items: new Bank().add(buyableObj.item, qty), collectionLog: true });
				return `You bought ${qty}x ${buyableObj.name}.`;
			} catch (e) {
				logError(e, {
					user_id: String(mahojiUser.id),
					slayer_buyable: buyable,
					slayer_buyable_id: String(buyableObj.id),
					quantity: String(qty)
				});
				return slayerPurchaseError;
			}
		} else {
			return `You don't have enough slayer points to purchase ${qty}x ${buyableObj.name}. You need ${cost} and you have ${mahojiUser.slayer_points}.`;
		}
	} else if (!disable) {
		// Here we unlock and unlockable reward:
		if (mahojiUser.slayer_unlocks.includes(buyableObj.id)) {
			return `You already have ${buyableObj.name} unlocked.`;
		}
		const cost = buyableObj.slayerPointCost;
		if (mahojiUser.slayer_points >= cost) {
			const newUnlocks = [...mahojiUser.slayer_unlocks, buyableObj.id];
			try {
				await mahojiUserSettingsUpdate(mahojiUser.id, {
					slayer_points: { decrement: cost },
					slayer_unlocks: newUnlocks
				});
				return `You successfully unlocked ${buyableObj.name}. Remaining slayer points: ${
					mahojiUser.slayer_points - cost
				}`;
			} catch (e) {
				logError(e, { user_id: mahojiUser.id, slayer_unlock: buyable });
				return slayerPurchaseError;
			}
		} else {
			return `You don't have enough slayer points to purchase ${buyableObj.name} You need ${buyableObj.slayerPointCost} and have ${mahojiUser.slayer_points}`;
		}
	} else {
		// Here we will disable a previous unlocked reward.
		if (!mahojiUser.slayer_unlocks.includes(buyableObj.id)) {
			return `You don't have ${buyableObj.name} unlocked.`;
		}
		if (interaction) {
			await handleMahojiConfirmation(
				interaction,
				`Are you sure you want disable ${buyableObj.name}? You will have to pay ${buyableObj.slayerPointCost} to unlock it again.`
			);
		}
		const newUnlocks = removeFromArr(mahojiUser.slayer_unlocks, buyableObj.id);
		await mahojiUserSettingsUpdate(mahojiUser.id, { slayer_unlocks: newUnlocks });
		return `You have disabled the reward: ${buyableObj.name}.`;
	}
}
export function slayerShopListMyUnlocks(mahojiUser: User) {
	if (mahojiUser.slayer_unlocks.length === 0) {
		return "You don't have any Slayer rewards unlocked.";
	}
	const myUnlocks = SlayerRewardsShop.filter(srs => mahojiUser.slayer_unlocks.includes(srs.id));
	const unlocksStr = myUnlocks.map(unlock => unlock.name).join('\n');

	const content =
		`Current points: ${mahojiUser.slayer_points}\n**You currently have the following ` +
		`rewards unlocked:**\n${unlocksStr}\n\n` +
		'Usage:\n`/slayer rewards [unlock|buy|disable] Reward`\nExample:' +
		'\n`/slayer rewards unlock unlockable:Malevolent Masquerade`';
	if (content.length > 2000) {
		return {
			content: 'Your currently unlocked Slayer rewards',
			attachments: [{ buffer: Buffer.from(content.replace(/`/g, '')), fileName: 'myUnlocks.txt' }]
		};
	}
	return content;
}

export function slayerShopListRewards(type: 'all' | 'unlocks' | 'buyables') {
	const availableUnlocks = SlayerRewardsShop.filter(srs =>
		type === 'all' ? true : type === 'unlocks' ? !srs.item : Boolean(srs.item)
	);

	const unlockTable = table([
		['Slayer Points', 'Name', 'Description', 'Type'],
		...availableUnlocks.map(i => [
			i.slayerPointCost,
			i.name,
			i.desc,
			i.extendMult === undefined ? 'unlock' : 'extend'
		])
	]);

	const content = type === 'all' ? 'List of all slayer rewards' : `List sof slayer ${type}`;
	return {
		content,
		attachments: [{ buffer: Buffer.from(unlockTable), fileName: 'slayerRewardsUnlocks.txt' }]
	};
}
