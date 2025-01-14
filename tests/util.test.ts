import { reduceNumByPercent } from 'e';
import { KlasaUser } from 'klasa';
import { Bank } from 'oldschooljs';

import { deduplicateClueScrolls } from '../src/lib/clues/clueUtils';
import getUserFoodFromBank from '../src/lib/minions/functions/getUserFoodFromBank';
import { getSkillsOfMahojiUser, sanitizeBank, stripEmojis, truncateString } from '../src/lib/util';
import getOSItem from '../src/lib/util/getOSItem';
import { sellPriceOfItem, sellStorePriceOfItem } from '../src/mahoji/commands/sell';
import { mockUser } from './utils';

describe('util', () => {
	test('stripEmojis', () => {
		expect(stripEmojis('b👏r👏u👏h')).toEqual('bruh');
	});

	test('getOSItem', () => {
		expect(getOSItem('Twisted bow').id).toEqual(20_997);
		expect(getOSItem(20_997).id).toEqual(20_997);
		expect(getOSItem('20997').id).toEqual(20_997);
		expect(getOSItem('3rd age platebody').id).toEqual(10_348);

		expect(() => getOSItem('Non-existant item')).toThrowError("Non-existant item doesn't exist.");
	});

	test('getUserFoodFromBank', () => {
		const fakeUser = (b: Bank) =>
			({
				bank: () => b,
				skillLevel: () => 99
			} as any as KlasaUser);
		expect(getUserFoodFromBank(fakeUser(new Bank().add('Shark')), 500, [])).toStrictEqual(false);
		expect(getUserFoodFromBank(fakeUser(new Bank().add('Shark', 100)), 500, [])).toStrictEqual(
			new Bank().add('Shark', 25)
		);
		expect(getUserFoodFromBank(fakeUser(new Bank().add('Shark', 30).add('Tuna', 20)), 750, [])).toStrictEqual(
			new Bank().add('Shark', 28).add('Tuna', 20)
		);
		expect(
			getUserFoodFromBank(
				fakeUser(new Bank().add('Shark', 100).add('Lobster', 20).add('Shrimps', 50).add('Coal')),
				1700,
				[]
			)
		).toStrictEqual(new Bank().add('Lobster', 20).add('Shark', 66).add('Shrimps', 50));
	});

	test('deduplicateClueScrolls', () => {
		const currentBank = new Bank().add('Clue scroll(easy)');
		const loot = new Bank().add('Clue scroll(easy)').add('Clue scroll(hard)', 10).add('Clue scroll(master)');
		expect(deduplicateClueScrolls({ loot, currentBank }).bank).toEqual(
			new Bank().add('Clue scroll(hard)').add('Clue scroll(master)').bank
		);
	});

	test('sanitizeBank', () => {
		let buggyBank = new Bank();
		buggyBank.bank[1] = -1;
		buggyBank.bank[2] = 0;
		sanitizeBank(buggyBank);
		expect(buggyBank.bank).toEqual({});
	});

	test('truncateString', () => {
		expect(truncateString('testtttttt', 5)).toEqual('te...');
	});

	test('sellPriceOfItem', () => {
		const item = getOSItem('Dragon pickaxe');
		const { price } = item;
		let expected = reduceNumByPercent(price, 20);
		expect(sellPriceOfItem(item)).toEqual({ price: expected, basePrice: price });
		expect(sellPriceOfItem(getOSItem('A yellow square'))).toEqual({ price: 0, basePrice: 0 });
	});

	test('sellStorePriceOfItem', () => {
		const item = getOSItem('Dragon pickaxe');
		const { cost } = item;

		let expectedOneQty =
			(((0.4 - 0.015 * Math.min(1 - 1, 10)) * Math.min(1, 11) + Math.max(1 - 11, 0) * 0.1) * cost) / 1;
		let expectedTwentytwoQty =
			(((0.4 - 0.015 * Math.min(22 - 1, 10)) * Math.min(22, 11) + Math.max(22 - 11, 0) * 0.1) * cost) / 22;
		expect(sellStorePriceOfItem(item, 1)).toEqual({ price: expectedOneQty, basePrice: cost });
		expect(sellStorePriceOfItem(item, 22)).toEqual({ price: expectedTwentytwoQty, basePrice: cost });
		expect(sellStorePriceOfItem(getOSItem('A yellow square'), 1)).toEqual({ price: 0, basePrice: 0 });
	});

	test('getSkillsOfMahojiUser', () => {
		expect(getSkillsOfMahojiUser(mockUser(), true).agility).toEqual(73);
		expect(getSkillsOfMahojiUser(mockUser()).agility).toEqual(1_000_000);
	});
});
