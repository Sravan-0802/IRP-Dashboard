/**
 * Academy user ids explicitly allowed to register for the 12 July 2026
 * L1 re-conduction outside the normal registration window (before 9 PM IST
 * on 7 July). They still cannot register after the global close time.
 */
const L1_JULY12_REGISTRATION_UNLOCK_RAW = `
ccfdff0d-9706-4323-a97b-02d0c2d7901f
4e1354b0-8c24-4843-a7ce-f3921230a8bf
21952a28-71cc-4a63-b570-31a2284a01b1
32b28d1d-04e9-4858-ac28-0e57d3929957
4c4963ff-8c54-4ce5-8d19-f28f53f1a744
8ec6967c-edcd-40f1-9a4d-bb2c255072b9
cf7a3c80-c10e-4065-b43a-78c40c1ad5b2
9266c3d7-8069-4912-a855-f8b5ca44717e
0915ea39-638d-4baa-829a-406ccad97c08
7600b711-e795-4fb4-ba9f-895663fd9496
07b5ce84-6f3e-4750-abcf-a31fda4c8bdb
c28b17f2-ff3f-40af-a2d4-a465a6388347
92ad5b06-42b3-426d-beb2-52caef9df970
f0e425a7-c85f-45a0-82f3-d1dd915249ab
9f2c0573-7916-4dca-9f08-939348c066bd
a9d120c4-2078-4457-9b15-7fc6406956d7
f203d7f4-bd7c-47cd-8d5e-8eea2c8c6443
82a7f4cb-fb51-4ad0-bb2d-0f551b2c7cac
a813e3b3-2260-4f9b-a749-d16d7a3daf8b
0c1c1994-5237-4348-b150-c827c377bd11
0465e3b2-16c8-4847-b304-f80fa9a66f55
e11ae04f-87ed-449b-905d-fe38f63216e3
49fff647-4aa8-410f-badf-391a45c7ef93
3962b52e-dce9-4243-ac70-26aa9699a4a8
9fba9f9b-eaab-4a5b-b165-cc5ad87d47f6
d62a54b7-1f50-4779-ae72-cc8fe115f6de
dc5c8c21-dcd2-4c00-adbb-fc275ebe7317
73463673-7a49-4aed-a5ce-2d15f4384b4b
a4f50df3-995e-430c-8de4-ce8a9bda1b6f
c1b04868-57ce-425b-bf16-138191d7c7e5
7e299ad4-31ea-4c51-973a-e407a4a3aeb1
2e6dd460-548c-4ac2-8fe8-96bd899faae5
e9de39f1-1679-4a96-b65f-2138031b4b14
e4c5bb79-4d16-471f-a62d-cc5583b77d45
8184ed67-db04-47d2-bbea-a65ce88d73de
30b6b625-b286-4c1b-8c71-e2280ee01d59
eb8e3d69-bcf5-41fc-8b50-99b4ec454f79
e3cd17e8-7401-4a76-a353-e27e5a7b64bd
823a5c36-6f97-48f5-845b-449f86640896
16220479-988b-484f-b1e1-24c86205a9b5
d643976b-806e-4ae8-98cf-e2a245f3b9b0
03f776be-d76f-4bc0-a797-d7f463b27d5b
ec2a1fb5-5477-4e4a-8be4-aa3c48c93329
01a659d2-be83-473c-97e8-6b0f1aaa8d90
ca963b21-7fd1-4ea7-8a47-62a8bbedb079
d38a7cdf-9b65-4da5-bd22-4f4df72e31ad
820a646e-fb7f-4dbe-bf0a-977eb69056ed
451bd7f9-46a7-4908-b701-187224aad2cc
5fe3af5d-525e-4cb3-93a1-a4ee6e3f8819
7139bf6a-1a9b-462a-bac8-85975c1405be
514fc5b1-d7bd-4e57-85eb-948d4fbf7429
`;

const L1_JULY12_REGISTRATION_UNLOCK = new Set(
  L1_JULY12_REGISTRATION_UNLOCK_RAW.split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export function isInL1July12RegistrationUnlock(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return L1_JULY12_REGISTRATION_UNLOCK.has(userId.trim().toLowerCase());
}
