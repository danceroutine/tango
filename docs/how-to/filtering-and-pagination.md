# Filtering and pagination

Filtering and pagination often appear together on list endpoints, but they solve different problems and should be designed as separate parts of the contract.

Filtering determines which records are eligible to appear in the result set. Pagination determines how that result set is traversed and presented to clients.

When those concerns are treated as one feature, the resulting endpoint contract usually becomes harder to explain and harder to test.

## A sensible implementation order

The easiest way to keep the behavior clear is to add the pieces in this order:

1. define the filtering contract
2. test that the eligible rows are correct
3. add the pagination strategy
4. test filtering and pagination together under realistic ordering

This order makes it easier to determine whether a bug comes from filter selection, sort order, or page traversal.

## Apply the pattern in Tango

For the filtering side of the contract, use:

- [How to add filtering](/how-to/filtering)

For the pagination side of the contract, use:

- [How to add pagination](/how-to/pagination)

## Testing advice

After implementing each part independently, add tests for combinations such as:

- filtered first page
- filtered later page
- filtered response with explicit ordering
- empty filtered response
